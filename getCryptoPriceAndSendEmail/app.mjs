import axios from 'axios';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const sesClient = new SESv2Client({ region: 'ap-southeast-2' });
const dbClient = new DynamoDBClient({ region: 'ap-southeast-2' });
const dbDocClient = DynamoDBDocumentClient.from(dbClient);

// cache for valid crypto and currency
// to avoid multiple API calls
let validCryptos = [];
let validCurrencies = [];

/**
 * Example request:
 * {
 *   "crypto": "bitcoin",
 *   "currency": "usd"
 * }
 */
export const handler = async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const email = body.email;
    const cryptos = body.crypto?.split(',').map(c => c.trim().toLowerCase());
    const currencies = body.currency?.split(',').map(c => c.trim().toLowerCase());

    // return error message if email is illegal
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing or invalid parameters: email.' }),
          };
    }

    // return error message if crypto is illegal
    if (!cryptos || cryptos.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing or invalid parameters: crypto.' }),
      };
    }

    // return error message if currency is illegal
    if (!currencies || currencies.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing or invalid parameters: currency.' }),
      };
    }

    // get valid cryptos and currencies from CoinGecko API
    if (!validCryptos.length || !validCurrencies.length) {
      validCryptos = await getValidCryptos();
      validCurrencies = await getValidCurrencies();
    }

    // check if the input cryptos are valid
    const invalidCryptos = cryptos.filter(c => !validCryptos.includes(c));
    if (invalidCryptos.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Invalid crypto: ${invalidCryptos.join(', ')}` }),
      };
    }

    // check if the input currencies are valid
    const invalidCurrencies = currencies.filter(c => !validCurrencies.includes(c));
    if (invalidCurrencies.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Invalid currency: ${invalidCurrencies.join(', ')}` }),
      };
    }

    // get crypto price from CoinGecko API
    const priceData = await getCryptoPrice(cryptos, currencies);

    // send email via SES
    await sendEmail({ email, priceData, cryptos, currencies });
    // save search history to DynamoDB
    await saveSearchHistory({ email, cryptos });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Price sent to ${email}`,
      }),
    };

  } catch (err) {
    console.error(err);
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      // handle 429 error (rate limit exceeded)
      return {
        statusCode: 429,
        body: JSON.stringify({ error: 'Request exceeds free CoinGecko API fequency limit, please try later.' }),
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      };
    }
  }
};

// get valid crypto ID list
async function getValidCryptos() {
  const res = await axios.get('https://api.coingecko.com/api/v3/coins/list');
  return res.data.map(c => c.id); // get all valid crypto ID e.g. ['bitcoin', 'ethereum', ...]
}

// get valid currency list
async function getValidCurrencies() {
  const res = await axios.get('https://api.coingecko.com/api/v3/simple/supported_vs_currencies');
  return res.data; // get all valid currency e.g. ['usd', 'eur', 'aud', ...]
}

async function getCryptoPrice(cryptos, currencies) {
  const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptos.join(',')}&vs_currencies=${currencies.join(',')}`)
  return res.data
}

async function sendEmail({ email, priceData, cryptos, currencies }) {
  const htmlContent = generateEmailContent(priceData, cryptos, currencies);

  const params = {
    FromEmailAddress: 'chenglinjing11@gmail.com',
    Destination: {
      ToAddresses: [email]
    },
    Content: {
      Simple: {
        Subject: {
          Charset: "UTF-8",
          Data: "Your Cryptocurrency Price Lookup Results"
        },
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: htmlContent
          }
        }
      }
    }
  };

  const sendCommand = new SendEmailCommand(params);
  try {
    await sesClient.send(sendCommand);
    console.log(`✅ Email sent to ${email}.`);
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error; // Rethrow the error to be handled in the main handler
  }
}

function generateEmailContent(priceData, cryptos, currencies) {
  let html = `
    <html>
    <body>
      <p>Hello Investor! 🚀</p>
      <p>Thank you for reaching out. Below are the cryptocurrency prices you requested:</p>
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <thead>
          <tr>
            <th>Cryptocurrency</th>
            ${currencies.map(currency => `<th>${currency.toUpperCase()}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${cryptos.map(crypto => {
            const row = currencies.map(currency => {
              const price = priceData[crypto]?.[currency];
              return `<td>${price !== undefined ? price : 'N/A'}</td>`;
            }).join('');
            return `<tr><td>${crypto}</td>${row}</tr>`;
          }).join('')}
        </tbody>
      </table>
      <p>We hope this information helps you stay on top of the market. If you have any further questions, feel free to reach out.</p>
      <p>Best regards,<br>Nimo Crypto Team</p>
    </body>
    </html>
  `;
  return html;
}

async function saveSearchHistory({ email, cryptos }) {
  const params = {
    TableName: 'crypto_search_history',
    Item: {
      id: uuidv4(),
      crypto: cryptos.join(', '),
      email,
      timestamp: new Date().toISOString(),
    },
  };

  try {
    await dbDocClient.send(new PutCommand(params));
    console.log('✅ Search history saved to DynamoDB.');
  } catch (error) {
    console.error('❌ Failed to save search history:', error);
    throw error; // Rethrow the error to be handled in the main handler
  }
}
