import axios from 'axios';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const REGION = 'ap-southeast-2';
const sesClient = new SESv2Client({ region: REGION });
const dbClient = new DynamoDBClient({ region: REGION });
const dbDocClient = DynamoDBDocumentClient.from(dbClient);

// Cache for valid crypto and currency to avoid multiple API calls
let validCryptos = [];
let validCurrencies = [];

export const handler = async (event) => {
  try {
    const { email, cryptos, currencies } = parseRequest(event.body);

    await validateInputs(email, cryptos, currencies);

    // Check if validCryptos and validCurrencies are already cached
    // If not, fetch them from the API
    if (validCryptos.length === 0 || validCurrencies.length === 0) {
      [validCryptos, validCurrencies] = await Promise.all([getValidCryptos(), getValidCurrencies()]);
    }

    validateAgainstAPI(cryptos, validCryptos, 'crypto');
    validateAgainstAPI(currencies, validCurrencies, 'currency');

    // Fetch crypto prices
    const priceData = await getCryptoPrice(cryptos, currencies);

    await Promise.all([
      sendEmail({ email, priceData, cryptos, currencies }),
      saveSearchHistory({ email, cryptos }),
    ]);

    return successResponse(`Price sent to ${email}`);
  } catch (err) {
    return handleError(err);
  }
};

function parseRequest(body) {
  const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
  const email = parsedBody.email;
  const cryptos = parsedBody.crypto?.split(',').map(c => c.trim().toLowerCase()) || [];
  const currencies = parsedBody.currency?.split(',').map(c => c.trim().toLowerCase()) || [];
  return { email, cryptos, currencies };
}

async function validateInputs(email, cryptos, currencies) {
  // Validate email format
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Missing or invalid parameter: email.');
  }
  // Validate crypto and currency
  if (!cryptos || cryptos.length === 0) {
    throw new Error('Missing or invalid parameter: crypto.');
  }
  if (!currencies || currencies.length === 0) {
    throw new Error('Missing or invalid parameter: currency.');
  }
}

function validateAgainstAPI(inputList, validList, type) {
  // Check if any invalid items exist
  const invalidItems = inputList.filter(item => !validList.includes(item));
  if (invalidItems.length) {
    throw new Error(`Invalid ${type}: ${invalidItems.join(', ')}`);
  }
}

async function getValidCryptos() {
  const res = await axios.get('https://api.coingecko.com/api/v3/coins/list');
  return res.data.map(c => c.id);
}

async function getValidCurrencies() {
  const res = await axios.get('https://api.coingecko.com/api/v3/simple/supported_vs_currencies');
  return res.data;
}

async function getCryptoPrice(cryptos, currencies) {
  const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
    params: { ids: cryptos.join(','), vs_currencies: currencies.join(',') },
  });
  return res.data;
}

async function sendEmail({ email, priceData, cryptos, currencies }) {
  const htmlContent = generateEmailContent(priceData, cryptos, currencies);
  const params = {
    FromEmailAddress: 'chenglinjing11@gmail.com',
    Destination: { ToAddresses: [email] },
    Content: {
      Simple: {
        Subject: { Charset: 'UTF-8', Data: 'Your Cryptocurrency Price Lookup Results' },
        Body: { Html: { Charset: 'UTF-8', Data: htmlContent } },
      },
    },
  };

  await sesClient.send(new SendEmailCommand(params));
  console.log(`✅ Email sent to ${email}.`);
}

// Generate HTML content for the email
function generateEmailContent(priceData, cryptos, currencies) {
  const rows = cryptos.map(crypto => {
    const cells = currencies.map(currency => {
      const price = priceData[crypto]?.[currency];
      return `<td>${price !== undefined ? price : 'N/A'}</td>`;
    }).join('');
    return `<tr><td>${crypto}</td>${cells}</tr>`;
  }).join('');

  return `
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
        <tbody>${rows}</tbody>
      </table>
      <p>We hope this information helps you stay on top of the market. If you have any further questions, feel free to reach out.</p>
      <p>Best regards,<br>Nimo Crypto Team</p>
    </body>
    </html>
  `;
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

  await dbDocClient.send(new PutCommand(params));
  console.log('✅ Search history saved to DynamoDB.');
}

function successResponse(message) {
  return {
    statusCode: 200,
    body: JSON.stringify({ message }),
  };
}

function handleError(err) {
  console.error(err);
  if (axios.isAxiosError(err) && err.response?.status === 429) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: 'Request exceeds free CoinGecko API frequency limit, please try later.' }),
    };
  }
  return {
    statusCode: 500,
    body: JSON.stringify({ error: err.message || 'Internal Server Error' }),
  };
}
