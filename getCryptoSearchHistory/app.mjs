import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { QueryCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const dbClient = new DynamoDBClient({ region: 'ap-southeast-2' });
const dbDocClient = DynamoDBDocumentClient.from(dbClient);

export const handler = async (event) => {
  try {
    const queryParams = event.queryStringParameters || {};
    const email = queryParams.email;
    const limit = parseInt(queryParams.limit) || 10;

    // return error message if startKey is illegal
    let startKey;
    try{
      startKey = queryParams.startKey ? JSON.parse(decodeURIComponent(queryParams.startKey)) : undefined;
    } catch(err){
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid parameter: startKey.' }),
      };
    }

    // return error message if email is illegal
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing or invalid parameter: email.' }),
          };
    }

    const params = {
      TableName: 'crypto_search_history',
      KeyConditionExpression: '#email = :email',
      ExpressionAttributeNames: {
        '#email': 'email',
      },
      ExpressionAttributeValues: {
        ':email': email,
      },
      Limit: limit,
      ExclusiveStartKey: startKey,
      ScanIndexForward: false  // descending order by timestamp
    };

    const result = await dbDocClient.send(new QueryCommand(params));

    return {
      statusCode: 200,
      body: JSON.stringify({
        items: result.Items,
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
