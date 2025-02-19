const { runQuery, runScan, TABLE_NAME} = require('/opt/dynamodb');
const { sendResponse, logger } = require('/opt/base');


exports.handler = async (event, context) => {
  logger.debug('Get all fees for specific park', event);
  // Allow CORS
  if (event.httpMethod === 'OPTIONS') {
    return sendResponse(200, {}, 'Success', null, context);
  }

  try {
    const queryParams = event.queryStringParameters;
    const queryType = getQueryType(queryParams);

    let query;
    if(queryParams){
      switch (queryType) {
        case 'withBilling':
          if (!queryParams.billingPer || !queryParams.activity || !queryParams.facilityName || !queryParams.ORCS) {
            throw {
              code: 400,
              error: 'Insufficient parameters.',
              msg: `Missing required parameters for 'withBilling' query`
            };
          }
          query = queryFeeWithBilling(queryParams.billingPer, queryParams.activity, queryParams.facilityName, queryParams.ORCS);
          break;
        case 'byActivity':
          if (!queryParams.activity || !queryParams.facilityName || !queryParams.ORCS) {
            throw {
              code: 400,
              error: 'Insufficient parameters.',
              msg: `Missing required parameters for 'byActivity' query`
            };
          }
          query = queryFeeByActivity(queryParams.activity, queryParams.facilityName, queryParams.ORCS);
          break;
        case 'byFacilityName':
          if (!queryParams.facilityName || !queryParams.ORCS) {
            throw {
              code: 400,
              error: 'Insufficient parameters.',
              msg: `Missing required parameters for 'byFacilityName' query`
            };
          }
          query = queryFeeByFacilityName(queryParams.facilityName, queryParams.ORCS);
          break;
        case 'byORCS':
          if (!queryParams.ORCS) {
            throw {
              code: 400,
              error: 'Insufficient parameters.',
              msg: `Missing required query parameter: 'ORCS'`
            };
          }
          query = queryFeeByORCS(queryParams.ORCS);
          console.log("query:", query);
          break;
        default:
          throw {
            code: 400,
            error: 'Insufficient parameters.',
            msg: `Missing required query parameter: 'ORCS'`
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
  } else if (queryParams?.ORCS) {
    return 'byORCS';
  } else {
    return 'insufficientParams';
  }
}
  function queryFeeByORCS(ORCS) {
    let query = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': {S: `${ORCS}::FEES`}
      }
    };  
    return query;
  }

  function queryFeeByFacilityName(facilityName, ORCS) {
    let query = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': { S: `${ORCS}::FEES` },
        ':sk': { S: facilityName }
      }
    };
    return query;
  }

function queryFeeByActivity(activity, facilityName, ORCS) {
  let query = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': { S: `${ORCS}::FEES` },
      ':sk': { S: `${facilityName}::${activity}` }
    }
  };
  return query;
}

function queryFeeWithBilling(billing, activity, facilityName, ORCS) {
  let query = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': { S: `${ORCS}::FEES` },
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
