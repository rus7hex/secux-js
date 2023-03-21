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
const { SignedTransaction } = require("@fioprotocol/fiosdk/lib/transactions/signed/SignedTransaction");
const { Query } = require("@fioprotocol/fiosdk/lib/transactions/queries/Query");
import { Api, ApiInterfaces, Ecc, Fio } from "@fioprotocol/fiojs";
import { deserialize, serialize } from "@fioprotocol/fiojs/dist/encryption-fio";
import { checkDecrypt, checkEncrypt } from "@fioprotocol/fiojs/dist/encryption-check";
import { SerialBuffer } from "@fioprotocol/fiojs/dist/chain-serialize";
import { base64ToBinary } from "@fioprotocol/fiojs/dist/chain-numeric";
import { hmac, sha1 } from "hash.js";
import { FirmwareError } from "@secux/utility";


export const SDK = new FIOSDK(
    '', // privateKey
    '', // publicKey
    "https://fio.blockpane.com/v1/", // baseUrl
    async (uri: RequestInfo, opts = {}) => {
        return Promise.race([
            fetch(uri, opts),
            new Promise((_, reject) => setTimeout(() => { reject("FIO api timeout") }, 30000))
        ]);
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

Reflect.defineProperty(Transactions.prototype, "getCipherContent", {
    value: async function (contentType: string, content: any, privateKey: string, publicKey: string) {
        if (privateKey && publicKey) {
            const cipher = Fio.createSharedCipher({ privateKey, publicKey });
            return cipher.encrypt(contentType, content);
        }

        const pubkey = new Ecc.PublicKey(publicKey).toBuffer();
        const secret = await _secret!.call(undefined, pubkey);
        return SharedCipher.encrypt(secret, contentType, content);
    },
    configurable: false
});

let secretMap: { [publickey: string]: Buffer } = {};
Reflect.defineProperty(Transactions.prototype, "getUnCipherContent", {
    value: function (contentType: string, content: any, privateKey: string, publicKey: string) {
        if (privateKey && publicKey) {
            const cipher = Fio.createSharedCipher({ privateKey, publicKey });
            return cipher.decrypt(contentType, content);
        }

        // because FioSDK use Array.forEach(...)
        return async () => {
            let secret = secretMap[publicKey];
            if (!secret) {
                const pubkey = new Ecc.PublicKey(publicKey).toBuffer();
                secret = await _secret!.call(undefined, pubkey);
                secretMap[publicKey] = secret;
            }

            return SharedCipher.decrypt(secret, contentType, content);
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


let _secret: ((pubkey: Buffer) => Promise<Buffer>) | null;
export function setSecretHook(hook: typeof _secret) {
    _secret = hook;
}

Reflect.defineProperty(SignedTransaction.prototype, "execute", {
    value: async function (privateKey: string, publicKey: string, dryRun = false) {
        this.privateKey = privateKey;
        this.publicKey = publicKey;

        const account = this.getAccount();
        const action = this.getAction();
        const data = await getData(this);
        const rawTransaction = await this.createRawTransaction({ account, action, data });

        const result = await this.pushToServer(rawTransaction, this.getEndPoint(), dryRun);
        return this.prepareResponse(result);
    },
    configurable: false
});

Reflect.defineProperty(Query.prototype, "execute", {
    value: async function (publicKey: string, privateKey: string = '') {
        this.publicKey = publicKey;
        this.privateKey = privateKey;

        if (!this.isEncrypted) {
            const data = await getData(this);
            return this.executeCall(this.getEndPoint(), JSON.stringify(data));
        }
        else {
            try {
                const data = await getData(this);
                const result = await this.executeCall(this.getEndPoint(), JSON.stringify(data));

                // because FioSDK use Array.forEach(...)
                const tasks = this.decrypt(result);
                const results = { ...tasks };
                for (const key in tasks) {
                    if (!Array.isArray(tasks[key])) continue;

                    secretMap = {};
                    results[key] = [];
                    for (const value of tasks[key]) {
                        if (!value.content) continue;

                        try {
                            value.content = await Promise.resolve(value.content());
                            results[key].push(value);
                        } catch (error) {
                            if (error instanceof FirmwareError) throw error;

                            // do nothing
                        }
                    }

                    break;
                }

                return results;
            } catch (error) {
                throw error;
            }
        }
    },
    configurable: false
});

async function getData(obj: any) {
    const data = obj.getData();
    data.content = await Promise.resolve(data.content);

    return data;
}


class SecretError extends Error { }

class SharedCipher {
    static #textEncoder = new TextEncoder();
    static #textDecoder = new TextDecoder();

    /**
        Encrypt the content of a FIO message.
        @arg {Buffer} secret
        @arg {string} fioContentType - `new_funds_content`, etc
        @arg {object} content
        @arg {Buffer} [IV = randomBytes(16)] - An unpredictable strong random value
            is required and supplied by default.  Unit tests may provide a static value
            to achieve predictable results.
        @return {string} cipher base64
    */
    static encrypt(secret: Buffer, fioContentType: string, content: any, IV?: Buffer): string {
        if (secret.length !== 64) throw new SecretError("Shared secret must be 64 bytes.");

        const buffer = new SerialBuffer({ textEncoder: this.#textEncoder, textDecoder: this.#textDecoder });
        serialize(buffer, fioContentType, content);
        const message = Buffer.from(buffer.asUint8Array());
        const cipherbuffer = checkEncrypt(secret, message, IV);

        return cipherbuffer.toString("base64");
    }

    /**
        Decrypt the content of a FIO message.
        @arg {Buffer} secret
        @arg {string} fioContentType - `new_funds_content`, etc
        @arg {object} content - cipher base64
        @return {object} decrypted FIO object
    */
    static decrypt(secret: Buffer, fioContentType: string, content: string): any {
        if (secret.length !== 64) throw new SecretError("Shared secret must be 64 bytes.");

        const message = checkDecrypt(secret, Buffer.from(content, "base64"));
        const messageArray = Uint8Array.from(message);
        const buffer = new SerialBuffer(
            {
                array: messageArray,
                textEncoder: this.#textEncoder,
                textDecoder: this.#textDecoder
            }
        );

        return deserialize(buffer, fioContentType);
    }

    /**
        @example hashA(PublicKey.toBuffer())
        @arg {Buffer} secret
        @arg {string|Buffer} key buffer
        @return {string} hex, one-way hash unique to this SharedCipher and key
    */
    static hashA(secret: Buffer, key: Buffer): String {
        if (secret.length !== 64) throw new SecretError("Shared secret must be 64 bytes.");

        //@ts-ignore
        const h = hmac(sha1, secret);
        const hashed = Buffer.from(h.update(key).digest());

        return `0x${hashed.slice(0, 16).toString("hex")}`;
    }
}