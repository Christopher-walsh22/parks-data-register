const { dynamodb, getOne, TABLE_NAME } = require('/opt/dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { sendResponse, logger } = require('/opt/base');

exports.handler = async (event, context) => {
  /**
   * Logs the update fees event.
   *
   * @param {string} message - The log message.
   * @returns {void}
   */
  logger.info('Update a fee for a specific park');
  // Allow CORS
  if (event.httpMethod === 'OPTIONS') {
    return sendResponse(200, {}, 'Success', null, context);
  }

  try {
    // Extracts the query params.
    const [orcs, FEES, facilityName, activity, billingPer] = event.pathParameters?.identifier?.split('::');

    const pk = `${orcs}::${FEES}`;
    const sk = `${facilityName}::${activity}::${billingPer}`;

    // Parses the request body as JSON
    let body = JSON.parse(event.body);

    // Extract 'isAdmin' from the request context authorizer
    const isAdmin = JSON.parse(event.requestContext?.authorizer?.isAdmin || false);
    // const user = event.requestContext?.authorizer?.userID;

    if (!isAdmin) {
      return sendResponse(403, [], 'Unauthorized', 'Unauthorized');
    }

    // Retrieves the current record based on the identifier.
    const currentRecord = await getOne(pk, sk);

    // If no currentRecord exists, we shouldn't perform any actions.
    if (!currentRecord?.pk) {
      throw `Protected area with identifier '${identifier}' not found.`;
    }

    // Calls the 'updateRecord' function to update the repealed record.
    let attributes = await updateRecord(pk, sk, body);

    // Returns a success response with the updated attributes.
    return sendResponse(200, attributes, 'Record updated');
  } catch (error) {
    // Logs any caught errors.
    logger.error(error);

    // Returns an error response with appropriate status code and message.
    return sendResponse(400, [], error?.msg || 'Error', error?.error || error, context);
  }
};

/**
 * Updates a record in DynamoDB.
 *
 * @param {String} pk
 * @param {String} sk
 * @param {Object} body - The request body.
 * @returns {Promise<Object>} - A Promise that resolves to the updated attributes.
 */
async function updateRecord(pk, sk, body) {
  let attributeName;
  let expressionAttributeNames = {};
  let updatedAttributeValues = {};
  let updateExpression = [];

  for (const field of OPTIONAL_PUT_FIELDS) {
    if (body.hasOwnProperty(field)) {
      attributeName = `#${field}`;
      expressionAttributeNames[attributeName] = field;
      updatedAttributeValues[`:${field}`] = { S: body[field] || '' };
      updateExpression.push(`${attributeName} = :${field}`);
    }
  }

  const updateParams = {
    TableName: TABLE_NAME,
    Key: {
      pk: { S: pk },
      sk: { S: sk }
    },
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: updatedAttributeValues,
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ReturnValues: 'ALL_NEW'
  };

  try {
    // Logs the update parameters for debugging purposes.
    logger.debug('updateParams', updateParams);

    // Executes the update operation and retrieves the updated attributes.
    const { Attributes } = await dynamodb.updateItem(updateParams);

    // Converts the DynamoDB attributes to a more usable format.
    logger.debug('Update success:', unmarshall(Attributes));

    return unmarshall(Attributes);
  } catch (error) {
    // Logs any errors that occur during the update operation.
    logger.error(error);
    let conditionalErrorFlag = false;
    if (error?.CancellationReasons) {
      // Check for ConditionalCheckFailed with transactional update.
      conditionalErrorFlag = error.CancellationReasons.find(item => {
        if (item?.Code === 'ConditionalCheckFailed') {
          return true;
        }
        return false;
      });
    }
    if (error?.code === 'ConditionalCheckFailedException') {
      // Check for ConditionalCheckFailedException with single item update.
      conditionalErrorFlag = true;
    }
    if (conditionalErrorFlag) {
      // You must provide the updateDate property from the existing record so versioning can be assured
      throw `Field mismatch: If performing a major change, confirm you are providing a new, different legal name. Confirm you are updating the most recent version of the record and try again.`;
    }

    // Propagates the error to the calling function.
    throw error;
  }
}

// directionOfTrip
const OPTIONAL_PUT_FIELDS = [
  'night',
  'day',
  'use',
  'week',
  'year',
  'trip',
  'directionOfTrip',
  'days28'
];
