import * as btc from "../packages/app-btc/__tests__/test";
import * as eth from "../packages/app-eth/__tests__/test";
import * as bnb from "../packages/app-bnb/__tests__/test";
import * as trx from "../packages/app-trx/__tests__/test";
import * as xlm from "../packages/app-xlm/__tests__/test";
import * as xrp from "../packages/app-xrp/__tests__/test";
import * as ada from "../packages/app-ada/__tests__/test";
import * as sol from "../packages/app-sol/__tests__/test";


export function test(GetDevice) {
    btc.test(GetDevice);
    eth.test(GetDevice);
    bnb.test(GetDevice);
    trx.test(GetDevice);
    xrp.test(GetDevice);
    xlm.test(GetDevice);
    ada.test(GetDevice);
    sol.test(GetDevice);
}