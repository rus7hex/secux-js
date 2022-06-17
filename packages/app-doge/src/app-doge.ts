/*!
Copyright 2022 SecuX Technology Inc
Copyright Chen Wei-En
Copyright Wu Tsung-Yu

Licensed under the Apache License, Version 2.0 (the License);
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an AS IS BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


import { SecuxBTC } from "@secux/app-btc";
import ow from "ow";
import { ow_strictPath } from "@secux/utility";
import { coinmap, CoinType } from "@secux/app-btc/lib/interface";
export { txInput, txOutput, txOutputAddress, txOutputScriptExtened } from "@secux/app-btc";


type T1 = Parameters<typeof SecuxBTC.addressConvert>;
type T2 = Parameters<typeof SecuxBTC.prepareAddress>;
type T3 = Parameters<typeof SecuxBTC.resolveAddress>;
type T4 = Parameters<typeof SecuxBTC.prepareSign>;
type T5 = Parameters<typeof SecuxBTC.resolveTransaction>;
const cointype = coinmap[CoinType.DOGECOIN].coinType;


/**
 * DOGE package for SecuX device
 */
export class SecuxDOGE extends SecuxBTC {
    /**
     * Convert publickey to BTC address
     * @param {communicationData} publickey secp256k1 publickey
     * @param {string | PathObject} path
     * @returns {string}
     */
    static addressConvert(...args: T1) {
        if (typeof args[1] === "string") {
            ow(args[1], ow_strictPath(cointype));
        }
        else {
            args[1].coin = CoinType.DOGECOIN;
        }

        return super.addressConvert(...args);
    }

    /**
     * prepare data for address generation
     * @param {string} path BIP32
     * @param {AddressOption} [option] option for validating bip32 path
     * @returns {communicationData} buffer for send
     */
    static prepareAddress(...args: T2) {
        ow(args[0], ow_strictPath(cointype));
        if (args[1]) {
            args[1].coin = CoinType.DOGECOIN;
        }

        return super.prepareAddress(...args);
    }

    /**
     * Resolve address
     * @param {communicationData} response
     * @param {string | PathObject} path
     * @returns {string}
     */
    static resolveAddress(...args: T3) {
        if (typeof args[1] === "string") {
            ow(args[1], ow_strictPath(cointype));
        }
        else {
            args[1].coin = CoinType.DOGECOIN;
        }

        return super.resolveAddress(...args);
    }

    /**
     * Prepare data for sign
     * @param {txInput} inputs
     * @param {txOutput} outputs
     * @returns {object} prepared
     * @returns {communicationData} prepared.commandData
     * @returns {string} prepared.rawTx
     */
    static prepareSign(...args: T4) {
        args[0].forEach(x => ow(x.path, ow_strictPath(cointype)));
        //@ts-ignore
        if (args[1].to.path) ow(args[1].to.path, ow_strictPath(cointype));
        if (args[1].utxo?.path) ow(args[1].utxo.path, ow_strictPath(cointype));

        return super.prepareSign(...args);
    }

    /**
     * Serialize transaction wtih signature for broadcast
     * @param {communicationData} response
     * @param {string} unsigned unsigned raw transaction
     * @param {Array<communicationData>} publickeys
     * @param {CoinType} [coin]
     * @returns {string} signed raw transaction
     */
    static resolveTransaction(...args: T5) {
        //@ts-ignore
        args[3] = CoinType.DOGECOIN;
        return super.resolveTransaction(...args);
    }
}