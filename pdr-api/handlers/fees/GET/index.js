const { runQuery, runScan, TABLE_NAME} = require('/opt/dynamodb');
const { sendResponse, logger } = require('/opt/base');


exports.handler = async (event, context) => {
  logger.debug('Get all fees for specific park', event);
  // Allow CORS
  if (event.httpMethod === 'OPTIONS') {
    return sendResponse(200, {}, 'Success', null, context);
  }

  try {
    const queryParams = event.queryStringParameters
    const queryType = getQueryType(queryParams);

    let query;
    if(queryParams){
      switch (queryType) {
        case 'withBilling':
          if (!queryParams.billingPer || !queryParams.activity || !queryParams.facilityName || !queryParams.orcs) {
            throw {
              code: 400,
              error: 'Insufficient parameters.',
              msg: `Missing required parameters for 'withBilling' query`
            };
          }
          query = queryFeeWithBilling(queryParams.billingPer, queryParams.activity, queryParams.facilityName, queryParams.orcs);
          break;
        case 'byActivity':
          if (!queryParams.activity || !queryParams.facilityName || !queryParams.orcs) {
            throw {
              code: 400,
              error: 'Insufficient parameters.',
              msg: `Missing required parameters for 'byActivity' query`
            };
          }
          query = queryFeeByActivity(queryParams.activity, queryParams.facilityName, queryParams.orcs);
          break;
        case 'byFacilityName':
          if (!queryParams.facilityName || !queryParams.orcs) {
            throw {
              code: 400,
              error: 'Insufficient parameters.',
              msg: `Missing required parameters for 'byFacilityName' query`
            };
          }
          query = queryFeeByFacilityName(queryParams.facilityName, queryParams.orcs);
          break;
        case 'byOrcs':
          if (!queryParams.orcs) {
            throw {
              code: 400,
              error: 'Insufficient parameters.',
              msg: `Missing required query parameter: 'orcs'`
            };
          }
          query = queryFeeByOrcs(queryParams.orcs);
          console.log("query:", query);
          break;
        default:
          throw {
            code: 400,
            error: 'Insufficient parameters.',
            msg: `Missing required query parameter: 'orcs'`
          };
      }

      let res = await runQuery(query);
      console.log("res:", res);
      return sendResponse(200, res, 'Success', null, context);
    }
    else {
      let scan = await scanFees();
      let res = await runScan(scan);
      console.log("res:", res);
      return sendResponse(200, res, 'Success', null, context);
    }
  } catch (err) {
    logger.error(err);
    return sendResponse(err?.code || 400, [], err?.msg || 'Error', err?.error || err, context);
  }
};

function getQueryType(queryParams) {
  if (queryParams?.billingPer) {
    return 'withBilling';
  } else if (queryParams?.activity) {
    return 'byActivity';
  } else if (queryParams?.facilityName) {
    return 'byFacilityName';
  } else if (queryParams?.orcs) {
    return 'byOrcs';
  } else {
    return 'insufficientParams';
  }
}
  function queryFeeByOrcs(orcs) {
    let query = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': {S: `${orcs}::FEES`}
      }
    };  
    return query;
  }

  function queryFeeByFacilityName(facilityName, orcs) {
    let query = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': { S: `${orcs}::FEES` },
        ':sk': { S: facilityName }
      }
    };
    return query;
  }

function queryFeeByActivity(activity, facilityName, orcs) {
  let query = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': { S: `${orcs}::FEES` },
      ':sk': { S: `${facilityName}::${activity}` }
    }
  };
  return query;
}

function queryFeeWithBilling(billing, activity, facilityName, orcs) {
  let query = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': { S: `${orcs}::FEES` },
      ':sk': { S: `${facilityName}::${activity}::${billing}` }
    }
  };
  return query
}

async function scanFees() {
  let scan = {
    TableName: TABLE_NAME,
    FilterExpression: 'contains(pk, :fees)',
    ExpressionAttributeValues: {
      ':fees': { S: '::FEES' }
    }
  };
  return scan;
}
