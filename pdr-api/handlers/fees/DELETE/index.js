// Import necessary libraries and modules
const { sendResponse, logger } = require('/opt/base');
const { runQuery, TABLE_NAME, deleteItem } = require('/opt/dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

// Lambda function entry point
// Lambda function entry point
exports.handler = async function (event, context) {
    logger.debug('Search:', event); // Log the search event
    // Allow CORS
    if (event.httpMethod === 'OPTIONS') {
      return sendResponse(200, {}, 'Success', null, context);
    }
  
    try {
      // Extract query parameters from the event
      const queryParams = event.queryStringParameters;
      logger.debug('Query Parameters:', queryParams);
  
      const requiredParams = ['ORCS', 'parkFeature', 'service', 'chargeBy'];
      for (const param of requiredParams) {
        if (!queryParams?.[param]) {
          logger.error(`Bad Request - Missing Param: ${param}`);
          return sendResponse(400, {}, 'Bad Request', `Missing Param: ${param}`, context);
        }
      }
  
      // Check if the user is an admin
      const isAdmin = event?.requestContext?.authorizer?.isAdmin || false;
  
      if (isAdmin) {
        // Construct the item to be deleted from DynamoDB
        const item = {
          pk: `${queryParams.ORCS}::FEES`,
          sk: `${queryParams.parkFeature}::${queryParams.service}::${queryParams.chargeBy}`
        };
        logger.debug('Constructed Item:', item);
  
        // Delete the item from DynamoDB
        let res;
        try {
          res = await deleteItem(marshall(item), TABLE_NAME);
          logger.debug('DynamoDB Response:', res);
        } catch (error) {
          logger.error('DynamoDB Error:', JSON.stringify(error));
          return sendResponse(500, {}, 'Internal Server Error', 'Failed to delete item from DynamoDB', context);
        }
  
        return sendResponse(200, res, 'Success', null, context);
      } else {
        return sendResponse(400, {}, 'Bad Request', 'must be admin to delete a fee', context);
      }
    } catch (err) {
      logger.error('Error:', JSON.stringify(err)); // Log the error
  
      // Send an error response
      return sendResponse(err?.code || 400, [], err?.msg || 'Error', err?.error || err, context);
    }
  };