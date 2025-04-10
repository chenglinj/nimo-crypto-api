import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { QueryCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const REGION = 'ap-southeast-2';
const dbClient = new DynamoDBClient({ region: REGION });
const dbDocClient = DynamoDBDocumentClient.from(dbClient);

export const handler = async (event) => {
  try {
    const { queryStringParameters = {} } = event;
    const { email, limit = 10, startKey } = queryStringParameters;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing or invalid parameter: email.' }),
      };
    }

    // Parse startKey
    let parsedStartKey;
    if (startKey) {
      try {
        parsedStartKey = JSON.parse(decodeURIComponent(startKey));
      } catch {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid parameter: startKey.' }),
        };
      }
    }

    const params = {
      TableName: 'crypto_search_history',
      KeyConditionExpression: '#email = :email',
      ExpressionAttributeNames: { '#email': 'email' },
      ExpressionAttributeValues: { ':email': email },
      Limit: parseInt(limit, 10),
      ExclusiveStartKey: parsedStartKey,
      ScanIndexForward: false, // descending order by timestamp
    };

    const result = await dbDocClient.send(new QueryCommand(params));

    return {
      statusCode: 200,
      body: JSON.stringify({
        items: result.Items || [],
        nextStartKey: result.LastEvaluatedKey
          ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey))
          : null,
      }),
    };
  } catch (err) {
    console.error('❌ Failed to fetch search history:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
