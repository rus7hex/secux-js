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


import { Interface } from "@ethersproject/abi";
import { prepareSign } from "./app-eth";
import ow from "ow";
import { baseData, ow_address, ow_baseData, ow_hexString32, PrefixedHexString } from "./interface";
import { getBuilder } from "./transaction";
import { owTool } from "@secux/utility";


export class ERC1155 {
    /**
     * ERC1155 Function Call
     * - function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _value, bytes calldata _data)
     * @param {string} path BIP32
     * @param {baseData} content 
     * @param {transferArgs} args 
     * @returns {object} prepared
     * @returns {communicationData} prepared.commandData
     * @returns {communicationData} prepared.rawTx
     */
    static prepareSafeTransferFrom(path: string, content: baseData, args: transferArgs) {
        ow(content, ow_baseData);
        ow(args, ow_transferArgs);


        const data = erc1155_def.encodeFunctionData("safeTransferFrom", [
            args.fromAddress,
            args.toAddress,
            args.id,
            args.value,
            args.data ?? Buffer.alloc(0)
        ]);
        const builder = getBuilder({
            ...content,
            data
        });

        return prepareSign(path, builder, false);
    }

    /**
     * ERC1155 Function Call
     * - function safeBatchTransferFrom(address _from, address _to, uint256[] calldata _ids, uint256[] calldata _values, bytes calldata _data)
     * @param {string} path BIP32
     * @param {baseData} content 
     * @param {batchTransferArgs} args 
     * @returns {object} prepared
     * @returns {communicationData} prepared.commandData
     * @returns {communicationData} prepared.rawTx
     */
    static prepareSafeBatchTransferFrom(path: string, content: baseData, args: batchTransferArgs) {
        ow(content, ow_baseData);
        ow(args, ow_batchTransferArgs);


        // It is RECOMMENDED that clients and wallets sort the token IDs and associated values (in ascending order) 
        // when posting a batch transfer, as some ERC-1155 implementations offer significant gas cost savings when 
        // IDs are sorted.
        const sorted = [...args.items].sort((a, b) => {
            const compare = toNumber(a.id) - toNumber(b.id);
            if (compare === 0) throw Error(`ArgumentError: duplicate id found, got "${toNumber(a.id)}"`);

            return compare;
        });

        const data = erc1155_def.encodeFunctionData("safeBatchTransferFrom", [
            args.fromAddress,
            args.toAddress,
            sorted.map(x => x.id),
            sorted.map(x => x.value),
            args.data ?? Buffer.alloc(0)
        ]);
        const builder = getBuilder({
            ...content,
            data
        });

        return prepareSign(path, builder, true);
    }
}

export const erc1155_def = new Interface([
    "function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _value, bytes calldata _data)",
    "function safeBatchTransferFrom(address _from, address _to, uint256[] calldata _ids, uint256[] calldata _values, bytes calldata _data)",
    "function balanceOf(address _owner, uint256 _id) external view returns (uint256)",
    "function balanceOfBatch(address[] calldata _owners, uint256[] calldata _ids) external view returns (uint256[] memory)",
    "function setApprovalForAll(address _operator, bool _approved)",
    "function isApprovedForAll(address _owner, address _operator) external view returns (bool)",

    "event TransferSingle(address indexed _operator, address indexed _from, address indexed _to, uint256 _id, uint256 _value)",
    "event TransferBatch(address indexed _operator, address indexed _from, address indexed _to, uint256[] _ids, uint256[] _values)",
    "event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved)",
    "event URI(string _value, uint256 indexed _id)",

    "function onERC1155Received(address _operator, address _from, uint256 _id, uint256 _value, bytes calldata _data) external returns(bytes4)",
    "function onERC1155BatchReceived(address _operator, address _from, uint256[] calldata _ids, uint256[] calldata _values, bytes calldata _data) external returns(bytes4)",
]);


export type transferArgs = {
    fromAddress: string,
    toAddress: string,
    id: number | PrefixedHexString,
    value: number | PrefixedHexString,
    data?: Buffer | PrefixedHexString
};

const ow_transferArgs = ow.object.exactShape({
    fromAddress: ow_address,
    toAddress: ow_address,
    id: ow.any(ow.number.positive, ow_hexString32),
    value: ow.any(ow.number.positive, ow_hexString32),
    data: ow.any(ow.undefined, owTool.prefixedhexString, ow.buffer)
});

export type item = {
    id: number | PrefixedHexString,
    value: number | PrefixedHexString
};

const ow_item = ow.object.exactShape({
    id: ow.any(ow.number.positive, ow_hexString32),
    value: ow.any(ow.number.positive, ow_hexString32)
})

export type batchTransferArgs = {
    fromAddress: string,
    toAddress: string,
    items: Array<item>,
    data?: Buffer | PrefixedHexString
};

const ow_batchTransferArgs = ow.object.exactShape({
    fromAddress: ow_address,
    toAddress: ow_address,
    items: ow.array.ofType(ow_item),
    data: ow.any(ow.undefined, owTool.prefixedhexString, ow.buffer)
});

function toNumber(value: number | PrefixedHexString) {
    if (typeof value === "number") return value;

    return parseInt(value.slice(2), 16);
}
