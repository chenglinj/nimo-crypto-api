import axios from 'axios';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const sesClient = new SESv2Client({ region: 'ap-southeast-2' });
const dbClient = new DynamoDBClient({ region: 'ap-southeast-2' });
const dbDocClient = DynamoDBDocumentClient.from(dbClient);

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
    const { crypto = 'bitcoin', currency = 'aud', email } = body;

    // return error message if email address is illegal
    if (!email) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Illegal email adddress provided' }),
          };
    }

    const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${crypto}&vs_currencies=${currency}`;
    const response = await axios.get(apiUrl);

    if (!response.data[crypto]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Invalid crypto name: ${crypto}` }),
      };
    }

    const price = response.data[crypto][currency];

    // send email via SES
    await sendEmail({ crypto, price, currency, email })
    // save search history to DynamoDB
    await saveSearchHistory({ crypto, price, email });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Price sent to ${email}`,
        data: JSON.stringify(response.data),
      }),
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

async function sendEmail({ crypto, price, currency, email }) {
  const message = `Hello investor! 🚀\n\nThe current price of ${crypto} is ${price} ${currency}.`;
  const emailParams = {
    FromEmailAddress: 'chenglinjing11@gmail.com',
    Destination: {
      ToAddresses: [email],
    },
    Content: {
      Simple: {
        Subject: {
          Data: `Crypto Price: ${crypto}`,
        },
        Body: {
          Text: {
            Data: message,
          },
        },
      },
    },
  };

  const sendCommand = new SendEmailCommand(emailParams);
  try {
    await sesClient.send(sendCommand);
    console.log(`✅ Email sent to ${email}.`);
  } catch (error) {
    console.error('❌ Failed to send email:', error);
  }
}

async function saveSearchHistory({ crypto, price, email }) {
  const params = {
    TableName: 'crypto_search_history',
    Item: {
      id: uuidv4(),
      crypto,
      price,
      email,
      timestamp: new Date().toISOString(),
    },
  };

  try {
    await dbDocClient.send(new PutCommand(params));
    console.log('✅ Search history saved to DynamoDB.');
  } catch (error) {
    console.error('❌ Failed to save search history:', error);
  }
}
