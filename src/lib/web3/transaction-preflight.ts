import type {
  Abi,
  Address,
  ContractFunctionArgs,
  ContractFunctionName,
  EstimateContractGasParameters,
  PublicClient,
} from "viem";
import { formatEther } from "viem";

const BASIS_POINTS = 10_000n;
const GAS_BUFFER_BPS = 12_000n;
const FEE_BUFFER_BPS = 20_000n;

export function applyBasisPointsBuffer(value: bigint, basisPoints: bigint) {
  return (value * basisPoints + BASIS_POINTS - 1n) / BASIS_POINTS;
}

export function applyGasBuffer(gasEstimate: bigint) {
  return applyBasisPointsBuffer(gasEstimate, GAS_BUFFER_BPS);
}

export async function estimateBufferedTransactionFees(publicClient: PublicClient) {
  const [block, fees] = await Promise.all([
    publicClient.getBlock({ blockTag: "latest" }),
    publicClient.estimateFeesPerGas(),
  ]);

  if (fees.gasPrice !== undefined && fees.maxFeePerGas === undefined) {
    return { gasPrice: applyBasisPointsBuffer(fees.gasPrice, FEE_BUFFER_BPS) };
  }

  const baseFee = block.baseFeePerGas ?? 0n;
  const maxPriorityFeePerGas = applyBasisPointsBuffer(
    fees.maxPriorityFeePerGas ?? 0n,
    FEE_BUFFER_BPS,
  );
  let maxFeePerGas = applyBasisPointsBuffer(
    fees.maxFeePerGas ?? (baseFee > 0n ? baseFee * 2n : 1n),
    FEE_BUFFER_BPS,
  );

  const minimum = baseFee + maxPriorityFeePerGas;
  if (maxFeePerGas < minimum) {
    maxFeePerGas = minimum + 50_000n;
  }

  return { maxFeePerGas, maxPriorityFeePerGas };
}

export async function assertSufficientBalanceForTransaction({
  publicClient,
  account,
  gas,
  value = 0n,
  feePerGas,
}: {
  publicClient: PublicClient;
  account: Address;
  gas: bigint;
  value?: bigint;
  feePerGas?: bigint;
}) {
  const balance = await publicClient.getBalance({ address: account });
  const resolvedFee =
    feePerGas ??
    (await publicClient.estimateFeesPerGas()).maxFeePerGas ??
    (await publicClient.estimateFeesPerGas()).gasPrice;

  if (!resolvedFee) {
    return;
  }

  const estimatedTotal = value + gas * resolvedFee;

  if (balance < estimatedTotal) {
    const missing = estimatedTotal - balance;
    throw new Error(
      `Insufficient funds for this transaction and gas. Add about ${formatEther(
        missing,
      )} ETH or lower the amount.`,
    );
  }
}

export async function prepareContractWrite<
  TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "nonpayable" | "payable">,
>({
  publicClient,
  account,
  value = 0n,
  ...request
}: {
  publicClient: PublicClient;
  account: Address;
  address: Address;
  abi: TAbi;
  functionName: TFunctionName;
  args?: ContractFunctionArgs<TAbi, "nonpayable" | "payable", TFunctionName>;
  value?: bigint;
}) {
  const feeFields = await estimateBufferedTransactionFees(publicClient);
  const feePerGas =
    "gasPrice" in feeFields ? feeFields.gasPrice : feeFields.maxFeePerGas;
  const gasEstimate = await publicClient.estimateContractGas({
    ...request,
    account,
    value,
  } as EstimateContractGasParameters<
    TAbi,
    TFunctionName,
    ContractFunctionArgs<TAbi, "nonpayable" | "payable", TFunctionName>
  >);
  const gas = applyGasBuffer(gasEstimate);

  await assertSufficientBalanceForTransaction({
    publicClient,
    account,
    gas,
    value,
    feePerGas,
  });

  return { gas, ...feeFields };
}
