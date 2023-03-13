import { Interface } from "@ethersproject/abi";
import { EthereumProvider } from "eip1193-provider";
import { ETHTransactionBuilder } from "@secux/app-eth/lib/transaction";


const OPTIMISM_GAS_PRICE_ORACLE_ADDRESS = "0x420000000000000000000000000000000000000F";
const OPTIMISM_GAS__PRICE_CONTRACT = new Interface([
    "function getL1Fee(bytes calldata _data) public view returns (uint256)",
]);

export async function getL1Fee(provider: EthereumProvider, txObject: any) {
    const serialized = new ETHTransactionBuilder(txObject).serialize(false);
    const abiData = OPTIMISM_GAS__PRICE_CONTRACT.encodeFunctionData("getL1Fee", [serialized]);

    const result = await provider.request({
        method: "eth_call",
        params: [
            {
                to: OPTIMISM_GAS_PRICE_ORACLE_ADDRESS,
                data: abiData
            }
        ]
    });

    return result;
}