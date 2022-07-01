import * as assert from 'assert';

import { odataFormatUrl } from '../../odataCommands';

suite('Url Format Tests', () => {
    let odataQueryDocument = `https://my344469-sso.crm.ondemand.com/sap/c4c/odata-sso/v1/customer/IndividualCustomerCollection?
    $filter=OwnerID eq '2341978'
    &$select=FirstName,LastName,CustomerID
    &$top=10
    &$format=json
    `
    let combinedUrl = `https://my344469-sso.crm.ondemand.com/sap/c4c/odata-sso/v1/customer/IndividualCustomerCollection?%24format=json&%24filter=OwnerID+eq+%272341978%27&%24select=FirstName%2CLastName%2CCustomerID&%24top=10`
    test('Can Format Url', () => {
        assert.equal(odataFormatUrl(odataQueryDocument), combinedUrl)
    })
});
