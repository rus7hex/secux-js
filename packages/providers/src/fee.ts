import { Interface } from "@ethersproject/abi";
import { EthereumProvider } from "eip1193-provider";
import { ETHTransactionBuilder } from "@secux/app-eth/lib/transaction";


const OPTIMISM_GAS_PRICE_ORACLE_ADDRESS = "0x420000000000000000000000000000000000000F";
const OPTIMISM_GAS__PRICE_CONTRACT = new Interface([
    "function getL1Fee(bytes calldata _data) public view returns (uint256)",
]);


export async function getPriorityFee(provider: EthereumProvider, percentiles = [25, 50, 75]) {
    const { baseFeePerGas, reward } = await provider.request({
        method: "eth_feeHistory",
        params: [
            "0x3",
            "latest",
            percentiles
        ]
    });

    const pivot = Math.floor(reward.length / 2);
    const priorityFees = percentiles.map((_, i) =>
        reward
            .map(x => x[i])
            .sort()[pivot]
    );

    return priorityFees;
}

export async function getL1Fee(provider: EthereumProvider, txObject: any) {
    const serialized = typeof txObject === "string" ? txObject :
        new ETHTransactionBuilder(txObject).serialize(false);
    const abiData = OPTIMISM_GAS__PRICE_CONTRACT.encodeFunctionData("getL1Fee", [serialized]);

    const result = await provider.request({
        method: "eth_call",
        params: [
            {
                to: OPTIMISM_GAS_PRICE_ORACLE_ADDRESS,
                data: abiData,
            },
            "latest"
        ]
    });

    return result;
}