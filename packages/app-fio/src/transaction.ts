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


const { FIOSDK } = require("@fioprotocol/fiosdk");
const { Transactions } = require("@fioprotocol/fiosdk/lib/transactions/Transactions");
import { Api, ApiInterfaces, Ecc, Fio } from "@fioprotocol/fiojs";
import { base64ToBinary } from "@fioprotocol/fiojs/dist/chain-numeric";


export const SDK = new FIOSDK(
    '', // privateKey
    '', // publicKey
    "https://fio.blockpane.com/v1/", // baseUrl
    async (uri: RequestInfo, opts = {}) => {
        return Promise.race([
            fetch(uri, opts),
            new Promise((_, reject) => setTimeout(() => { reject("FIO api timeout") }, 30000))
        ])
    }
);

export function setApiUrl(url: string) {
    Transactions.baseUrl = url;
}


SDK.setSignedTrxReturnOption(true);
Object.freeze(SDK.privateKey);
Object.freeze(SDK.returnPreparedTrx);

let _FioProvider = {
    ...Fio,
    prepareTransaction
};
Object.defineProperty(Transactions, "FioProvider", {
    get() {
        return _FioProvider;
    },
    set(value) {
        _FioProvider = {
            ...value,
            prepareTransaction
        }
    },
    configurable: false
});


async function prepareTransaction(
    { transaction, chainId, privateKeys, abiMap, textDecoder, textEncoder }: {
        transaction: any,
        chainId: string,
        privateKeys: string[], // treat as bip44 path
        abiMap: Map<string, any>,
        textDecoder?: TextDecoder,
        textEncoder?: TextEncoder,
    }
) {
    if (privateKeys.some(x => !!x)) return Fio.prepareTransaction;

    const abiProvider: ApiInterfaces.AbiProvider = {
        getRawAbi: async function (accountName: string) {
            const rawAbi = abiMap.get(accountName);
            if (!rawAbi) {
                throw new Error(`Missing ABI for account ${accountName}`);
            }
            const abi = base64ToBinary(rawAbi.abi);

            return { accountName: rawAbi.account_name, abi };
        }
    };

    //@ts-ignore
    const api = new Api({
        abiProvider,
        chainId,
        textDecoder,
        textEncoder,
    });
    const { serializedTransaction, serializedContextFreeData } = await api.transact(transaction, { sign: false });

    const tx = Buffer.from(serializedTransaction);
    const sigData = Buffer.concat([
        Buffer.from(chainId, 'hex'),
        tx,
        serializedContextFreeData ?
            Buffer.from(Ecc.sha256(serializedContextFreeData), "hex") :
            Buffer.allocUnsafe(32)
        ,
    ]);

    return {
        signatures: [],
        compression: 0,
        packed_context_free_data: Buffer.from((serializedContextFreeData || new Uint8Array(0))).toString("hex"),
        packed_trx: tx.toString("hex"),
        sigData
    }
}
