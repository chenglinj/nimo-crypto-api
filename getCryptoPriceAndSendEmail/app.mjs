import axios from 'axios';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const sesClient = new SESv2Client({ region: 'ap-southeast-2' });

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

    if (!email) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing 'email' in request body" }),
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
    const message = `Hello investor! 🚀\n\nThe current price of ${crypto} is ${price} ${currency}.`;

    // send email
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
    await sesClient.send(sendCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `price sent to ${email}`,
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
