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
import { TransactionType } from "@secux/protocol-transaction/lib/interface";


export class ERC721 {
    /**
     * ERC721 Function Call
     * - function safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes [data]) external payable
     * @param {string} path BIP32
     * @param {baseData} content 
     * @param {safeTransferDataArgs} args
     * @returns {object} prepared
     * @returns {communicationData} prepared.commandData
     * @returns {communicationData} prepared.rawTx
     */
    static prepareSafeTransferFrom(path: string, content: baseData, args: safeTransferDataArgs) {
        ow(content, ow_baseData);
        ow(args, ow_safeTransferDataArgs);


        const data = (args.data) ?
            erc721_def.encodeFunctionData(
                "safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes data)",
                [args.fromAddress, args.toAddress, args.tokenId, args.data]
            ) :
            erc721_def.encodeFunctionData(
                "safeTransferFrom(address _from, address _to, uint256 _tokenId)",
                [args.fromAddress, args.toAddress, args.tokenId]
            );
        const builder = getBuilder({
            ...content,
            data
        });

        return prepareSign(path, builder, TransactionType.NFT);
    }

    /**
     * ERC721 Function Call
     * - function transferFrom(address _from, address _to, uint256 _tokenId) external payable
     * @param {string} path BIP32
     * @param {baseData} content 
     * @param {safeTransferArgs} args 
     * @returns {object} prepared
     * @returns {communicationData} prepared.commandData
     * @returns {communicationData} prepared.rawTx
     */
    static prepareTransferFrom(path: string, content: baseData, args: safeTransferArgs) {
        ow(content, ow_baseData);
        ow(args, ow_safeTransferArgs);


        const data = erc721_def.encodeFunctionData("transferFrom", [args.fromAddress, args.toAddress, args.tokenId]);
        const builder = getBuilder({
            ...content,
            data
        });

        return prepareSign(path, builder, TransactionType.NFT);
    }

    /**
     * ERC721 Function Call
     * - function approve(address _approved, uint256 _tokenId) external payable
     * @param {string} path BIP32
     * @param {baseData} content 
     * @param {safeTransferArgs} args 
     * @returns {object} prepared
     * @returns {communicationData} prepared.commandData
     * @returns {communicationData} prepared.rawTx
     */
    static prepareApprove(path: string, content: baseData, args: approveArgs) {
        ow(content, ow_baseData);
        ow(args, ow_approveArgs);


        const data = erc721_def.encodeFunctionData("approve", [args.toAddress, args.tokenId]);
        const builder = getBuilder({
            ...content,
            data
        });

        return prepareSign(path, builder, TransactionType.NFT);
    }
}

export const erc721_def = new Interface([
    "function balanceOf(address _owner) external view returns (uint256)",
    "function ownerOf(uint256 _tokenId) external view returns (address)",
    "function safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes data) external payable",
    "function safeTransferFrom(address _from, address _to, uint256 _tokenId) external payable",
    "function transferFrom(address _from, address _to, uint256 _tokenId) external payable",
    "function approve(address _approved, uint256 _tokenId) external payable",
    "function setApprovalForAll(address _operator, bool _approved) external",
    "function getApproved(uint256 _tokenId) external view returns (address)",
    "function isApprovedForAll(address _owner, address _operator) external view returns (bool)",
    "function supportsInterface(bytes4 interfaceID) external view returns (bool)",
    "function onERC721Received(address _operator, address _from, uint256 _tokenId, bytes _data) external returns(bytes4)",

    "event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId)",
    "event Approval(address indexed _owner, address indexed _approved, uint256 indexed _tokenId)",
    "event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved)",

    // OPTIONAL
    "function name() external view returns (string _name)",
    "function symbol() external view returns (string _symbol)",
    "function tokenURI(uint256 _tokenId) external view returns (string)",
    "function totalSupply() external view returns (uint256)",
    "function tokenByIndex(uint256 _index) external view returns (uint256)",
    "function tokenOfOwnerByIndex(address _owner, uint256 _index) external view returns (uint256)"
]);


export interface safeTransferArgs {
    fromAddress: string,
    toAddress: string,
    tokenId: number | PrefixedHexString
}

const _safeTransferArgs = {
    fromAddress: ow_address,
    toAddress: ow_address,
    tokenId: ow.any(ow.number.positive, ow_hexString32)
}

const ow_safeTransferArgs = ow.object.exactShape(_safeTransferArgs);

export interface safeTransferDataArgs extends safeTransferArgs {
    data?: PrefixedHexString | Buffer
}

const ow_safeTransferDataArgs = ow.object.exactShape({
    ..._safeTransferArgs,
    data: ow.any(ow.undefined, owTool.prefixedhexString, ow.buffer)
});

export type approveArgs = {
    toAddress: string,
    tokenId: number | PrefixedHexString
}

const ow_approveArgs = ow.object.exactShape({
    toAddress: ow_address,
    tokenId: ow.any(ow.number.positive, ow_hexString32)
});