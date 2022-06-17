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


import ow from "ow";
import { Base58 } from "@secux/utility/lib/bs58";
import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { EllipticCurve, TransactionType } from "@secux/protocol-transaction/lib/interface";
import { communicationData, getBuffer, toCommunicationData, wrapResult } from "@secux/utility/lib/communication";
import { IPlugin, ITransport, staticImplements } from "@secux/transport";
import {
    ATAOption, BuiltinInstruction, Instruction, InstructionMap, ow_address, ow_ATAOption, ow_path, ow_publickey,
    ow_SeedOption, ow_txDetail, SeedOption, txDetail
} from "./interface";
import { Transaction } from "./transaction";
import { loadPlugin, Logger, Signature } from "@secux/utility";
import { createProgramAccount, createWithSeed, isOnCurve, toPublickey } from "./utils";
import { TokenInstruction } from "./instruction";
import { Action } from "./action";
const logger = Logger?.child({ id: "app-sol" });


/**
 * SOL package for SecuX device
 */
@staticImplements<IPlugin>()
export class SecuxSOL {
    static get Action() { return Action; }

    /**
     * Convert ed25519 publickey to SOL address.
     * @param {string | Buffer} publickey ed25519 publickey
     * @param {ATAOption | SeedOption} [option]
     * @returns {string} address
     */
    static addressConvert(publickey: string | Buffer, option?: ATAOption | SeedOption): string {
        ow(publickey, ow_publickey);

        const pk = toBuffer(publickey);
        if (!option) return Base58.encode(pk);

        if ((option as SeedOption).seed) {
            ow(option, ow_SeedOption);
            const newPubkey = createWithSeed(pk, option.seed, Base58.decode(option.programId));

            return Base58.encode(newPubkey);
        }

        ow(option, ow_ATAOption);
        if (!isOnCurve(pk)) throw Error(`ArgumentError: token owner cannot be a derived account, got ${Base58.encode(pk)}`);

        for (let nonce = 255; nonce > 0; nonce--) {
            try {
                const programId = Buffer.from(TokenInstruction.TOKEN_PROGRAM_ID, "hex");
                const associatedProgramId = Buffer.from(TokenInstruction.ASSOCIATED_TOKEN_PROGRAM_ID, "hex");
                const mint = Base58.decode(option.mintAccount);

                return Base58.encode(
                    createProgramAccount(
                        [pk, programId, mint, Buffer.from([nonce])],
                        associatedProgramId
                    )
                );
            } catch (error) {
                if (error instanceof TypeError) throw error;
            }
        }

        throw Error(`Unable to find a viable program address nonce`);
    }

    /**
     * Prepare data for SOL address.
     * @param {string} path BIP32 path (hardened child key), ex: m/44'/501'/0'/0'
     * @returns {communicationData} data for sending to device
     */
    static prepareAddress(path: string): communicationData {
        return this.preparePublickey(path);
    }

    /**
     * Generate SOL address from response data.
     * @param {communicationData} response data from device
     * @param {ATAOption | SeedOption} [option]
     * @returns {string} SOL address
     */
    static resolveAddress(response: communicationData, option?: ATAOption | SeedOption): string {
        const pk = this.resolvePublickey(response);
        return this.addressConvert(pk, option);
    }

    /**
     * Prepare data for ed25519 publickey.
     * @param {string} path BIP32 path (hardened child key), ex: m/44'/501'/0'/0'
     * @returns {communicationData} data for sending to device
     */
    static preparePublickey(path: string): communicationData {
        ow(path, ow_path);
        return SecuxTransactionTool.getPublickey(path, EllipticCurve.ED25519);
    }

    /**
     * Resove ed25519 publickey from response data.
     * @param {communicationData} response data from device
     * @returns {string} ed25519 publickey (hex string)
     */
    static resolvePublickey(response: communicationData): string {
        const pk_64 = SecuxTransactionTool.resolvePublickey(response, EllipticCurve.ED25519);
        const pk = Buffer.from(pk_64, "base64");

        return pk.toString("hex");
    }

    /**
     * Prepare data for signing.
     * @param {string} feePayer solana account
     * @param {txDetail} content transaction object
     * @returns {prepared} prepared object
     */
    static prepareSign(feePayer: string, content: txDetail): { commandData: communicationData, serialized: communicationData } {
        ow(feePayer, ow_address);
        ow(content, ow_txDetail);

        const tx = new Transaction(content.recentBlockhash);
        for (const ins of content.instructions) {
            // builtin intruction
            const { type, params } = ins as BuiltinInstruction;
            if (type) {
                tx.addInstruction(InstructionMap[type](params));
                continue;
            }

            const { programId, accounts, data } = ins as Instruction;
            tx.addInstruction({
                programId: toPublickey(programId),
                accounts: accounts.map(x => ({
                    ...x,
                    publickey: x.publickey.toString("hex")
                })),
                data: toBuffer(data)
            });
        }

        const signData = tx.serialize(toPublickey(feePayer));
        const signers = tx.Signers.map(x => SecuxSOL.addressConvert(x));
        if (signers.length < content.ownerships.length) {
            logger?.warn(`expect ${signers.length} signers, but got ${content.ownerships.length}`);
        }
        const checks: { [pubkey: string]: string } = {};
        signers.forEach(x => checks[x] = '');
        const paths: Array<string> = [];
        for (const owner of content.ownerships) {
            let check = checks[owner.account];
            if (check === undefined) continue;
            if (!!check) continue;
            
            checks[owner.account] = owner.path;
            paths.push(owner.path);
        }
        for (const account of Object.keys(checks)) {
            if (!checks[account]) throw Error(`ArgumentError: path of account "${account}" not found`);
        }

        const txs = paths.map(_ => signData);
        const commandData = SecuxTransactionTool.signRawTransactionList(
            paths, txs, undefined,
            {
                tp: TransactionType.NORMAL,
                curve: EllipticCurve.ED25519
            }
        );

        const serialized = Buffer.from(JSON.stringify({
            rawTx: signData.toString("hex"),
            map: content.ownerships.map(x => toPublickey(x.account!))
        }));

        return wrapResult({ commandData, serialized: toCommunicationData(serialized) });
    }

    /**
     * Reslove signatures from response data.
     * @param {communicationData} response data from device
     * @returns {Array<string>} signature array (base58 encoded)
     */
    static resolveSignatureList(response: communicationData): Array<string> {
        const sigs = getSignatures(response);
        return sigs.map(x => Base58.encode(x));
    }

    /**
     * Resolve transaction for broadcasting.
     * @param {communicationData} response data from device
     * @param {communicationData} serialized 
     * @returns {string} signed transaction (hex)
     */
    static resolveTransaction(response: communicationData, serialized: communicationData): string {
        const sigs = getSignatures(response);
        const { rawTx, map } = JSON.parse(getBuffer(serialized).toString());
        if (sigs.length !== map.length) throw Error(`expect ${map.length} signatures, but got ${sigs.length}`);

        const tx = Transaction.from(Buffer.from(rawTx, "hex"));
        for (let i = 0; i < sigs.length; i++) {
            tx.addSignature(map[i], sigs[i]);
        }

        return tx.finalize().toString("hex");
    }

    static async getAddress(this: ITransport, path: string, option?: ATAOption | SeedOption) {
        const data = SecuxSOL.prepareAddress(path);
        const rsp = await this.Exchange(getBuffer(data));
        const address = SecuxSOL.resolveAddress(rsp, option);

        return address;
    }

    static async getPublickey(this: ITransport, path: string) {
        const data = SecuxSOL.preparePublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const publickey = SecuxSOL.resolvePublickey(rsp);

        return publickey;
    }

    static async getXPublickey(this: ITransport, path: string): Promise<string> {
        throw Error("Solana(SOL) do not support xpub.");
    }

    static async sign(this: ITransport, feePayer: string, content: txDetail) {
        for (const owner of content.ownerships) {
            if (owner.account) continue;

            owner.account = await SecuxSOL.getAddress.call(this, owner.path);
        }

        const { commandData, serialized } = SecuxSOL.prepareSign(feePayer, content);
        const rsp = await this.Exchange(getBuffer(commandData));
        const raw_tx = SecuxSOL.resolveTransaction(rsp, serialized);

        return { raw_tx };
    }
}


function getSignatures(response: communicationData) {
    const sigBufList = SecuxTransactionTool.resolveSignatureList(response).map(x => Buffer.from(x, "base64"));
    const sigList = sigBufList.map(x => Signature.fromSignature(x));

    return sigList.map(x => Buffer.concat([x.r, x.s]));
}

loadPlugin(SecuxSOL, "SecuxSOL");


function toBuffer(data: string | Buffer) {
    if (typeof data === "string") return Buffer.from(data, "hex");

    return data;
}

/**
 * Data type for transmission.
 * @typedef {string | Buffer} communicationData
 */

/**
 * Parameters for associated token address.
 * @typedef {object} ATAOption 
 * @property {string} mintAccount token mint address
 */

/**
 * Parameters for account with seed.
 * @typedef {object} SeedOption 
 * @property {string} seed arbitary string (UTF-8)
 * @property {string} programId program address
 */

/**
 * The accounts required by program.
 * @typedef {object} accounts
 * @property {string | Buffer} publickey Ed25519 publickey
 * @property {boolean} isSigner
 * @property {boolean} isWritable
 */

/**
 * The raw instruction object.
 * @typedef {object} Instruction
 * @property {string} programId program address
 * @property {accounts} accounts
 * @property {string | Buffer} data hex string or buffer
 */

/**
 * The bultin instruction object.
 * @typedef {object} BuiltinInstruction
 * @property {string} type instruction type
 * @property {any} params parameters
 */

/**
 * Account that needs to sign transaction.
 * @typedef {object} ownership
 * @property {string} path
 * @property {string} account
 */

/**
 * The transaction object.
 * @typedef {object} txDetail
 * @property {string} recentBlockhash a recent blockhash
 * @property {Array<Instruction | BuiltinInstruction>} instructions a least one instruction in a transaction
 * @property {Array<ownership>} ownerships for signing via SecuX wallet
 */

/**
 * Object for the signing and validation.
 * @typedef {object} prepared
 * @property {communicationData} commandData data for sending to device
 * @property {communicationData} serialized 
 */