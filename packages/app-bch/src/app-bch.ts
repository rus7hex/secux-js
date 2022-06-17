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


import { CoinType, SecuxBTC, ScriptType } from "@secux/app-btc";
import ow from "ow";
import { ow_strictPath } from "@secux/utility";
import { coinmap, ow_path, ow_PathObject } from "@secux/app-btc/lib/interface";


type T1 = Parameters<typeof SecuxBTC.addressConvert>;
type T2 = Parameters<typeof SecuxBTC.prepareAddress>;
type T3 = Parameters<typeof SecuxBTC.resolveAddress>;
type T4 = Parameters<typeof SecuxBTC.prepareSign>;
type T5 = Parameters<typeof SecuxBTC.resolveTransaction>;
const cointype = coinmap[CoinType.BITCOINCASH].coinType;


/**
 * BCH package for SecuX device
 */
export class SecuxBCH extends SecuxBTC {
    /**
     * Convert publickey to BCH address
     * @param {communicationData} publickey secp256k1 publickey
     * @param {string | PathObject} path
     * @returns {string}
     */
    static addressConvert(...args: T1) {
        if (typeof args[1] === "string") {
            checkPath(args[1]);
        }
        else {
            args[1].coin = CoinType.BITCOINCASH;
            checkScriptType(args[1].script);
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
        checkPath(args[0]);
        if (args[1]) {
            args[1].coin = CoinType.BITCOINCASH;
            if (args[1].script !== undefined) checkScriptType(args[1].script);
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
        let script;
        if (typeof args[1] === "string") {
            checkPath(args[1]);

            const element = args[1].match(/\d+/g)!;
            script = (element[0] === "49") ? ScriptType.P2SH_P2PKH : ScriptType.P2PKH;
        }
        else {
            ow(args[1], ow_PathObject);
            checkScriptType(args[1].script);
            script = args[1].script;
        }

        return super.resolveAddress(args[0], { coin: CoinType.BITCOINCASH, script });
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
        for (let input of args[0]) {
            checkPathForSign(input.path);
            input.script = ScriptType.P2PKH;
        }

        //@ts-ignore
        checkPathForSign(args[1].to.path);
        checkPathForSign(args[1].utxo?.path);

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
        return super.resolveTransaction(args[0], {
            ...args[1],
            coin: CoinType.BITCOINCASH
        });
    }
}


function checkPath(path: string) {
    ow(path, ow_strictPath(cointype, [44, 49]));
}

function checkScriptType(script: ScriptType) {
    if (!Object.values([ScriptType.P2PKH, ScriptType.P2SH_P2PKH]).includes(script))
        throw Error(`ArgumentError: invalid script for BCH, got "${ScriptType[script]}"`);
}

function checkPathForSign(path?: string) {
    if (!path) return;
    ow(path, ow_strictPath(cointype, [44, 49]));
}