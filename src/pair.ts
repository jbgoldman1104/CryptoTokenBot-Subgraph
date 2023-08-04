import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import {
  Burn as BurnEvent,
  Mint as MintEvent,
  Pair as PairContract,
  Swap as SwapEvent,
} from "../generated/Pair/Pair"
import { Burn, Mint, Pair, Swap, Token, TokenHistory } from "../generated/schema"
import { PairTokens, TokenDefinition } from "./tokenDefinition";
import { ZERO_BD, ZERO_BI } from "../const/helpers";

function getPairTokens(pair: Address) : PairTokens {
  let pairContract = PairContract.bind(pair);
  return new PairTokens(pairContract.try_token0(), pairContract.try_token1());
}

function getUpdatedPairInfo(address: Address, pair: Pair): Pair {
  let pairContract = PairContract.bind(address);

  pair.reserve0 = pairContract.getReserves().get_reserve0();
  pair.reserve1 = pairContract.getReserves().get_reserve1();
  pair.totalSupply = pairContract.totalSupply();

  pair.save();

  return pair;
}

function getExistingPairInfo(address: Address) : Pair {
  let pair = Pair.load(address.toHexString());
  if ( !pair ) {
    pair = new Pair(address.toHexString());
    let pairContract = PairContract.bind(address);

    pair.token0 = pairContract.token0().toHexString();
    pair.token1 = pairContract.token1().toHexString();

    pair.reserve0 = ZERO_BI;
    pair.reserve1 = ZERO_BI;
    pair.trackedReserveETH = ZERO_BI;
    pair.reserveETH = ZERO_BI;
    pair.reserveUSD = ZERO_BI;
    pair.totalSupply = ZERO_BI;
  }

  return pair;
}

function updateTokenPoolInfo(address: Address, reserveAfter: BigInt, reserveBefore:BigInt, liquidityAfter: BigInt, liquidityBefore: BigInt, 
   event: ethereum.Event): void {
  let token = Token.load(address.toHexString());
  if (!token) {
    return;
  }

  token.poolAmount = token.poolAmount.plus(reserveAfter).minus(reserveBefore);
  token.totalLiquidity = token.totalLiquidity.plus(liquidityAfter).minus(liquidityBefore);
  
  token.save();

  let minutes = event.block.timestamp.div(BigInt.fromI32(60))
  let historyId = event.address.toHexString().concat(minutes.toString())

  let tokenHistory = TokenHistory.load(historyId);
  
  if (!tokenHistory ){
    tokenHistory = new TokenHistory(historyId);
  }

  tokenHistory.timeInMinutes = minutes

  tokenHistory.poolAmount = token.poolAmount;
  tokenHistory.totalLiquidity = token.totalLiquidity;
  tokenHistory.price = token.price;
  tokenHistory.totalHolders = token.totalHolders;
  tokenHistory.txCount = token.txCount;    
  tokenHistory.totalSupply = token.totalSupply;
  tokenHistory.token = token.id;
  tokenHistory.save();
  
}

function handlePoolChange(eventAddress: Address, token0Address: Address, token1Address: Address, event: ethereum.Event): void {
    let pair = getExistingPairInfo(eventAddress);

    let reserve0Before = pair.reserve0;
    let reserve1Before = pair.reserve1;
    let totalSupplyBefore = pair.totalSupply;

    pair = getUpdatedPairInfo(eventAddress, pair);

    let reserve0After = pair.reserve0;
    let reserve1After = pair.reserve1;
    let totalSupplyAfter = pair.totalSupply;

    let token = Token.load(token0Address.toHexString());
    updateTokenPoolInfo(token0Address, reserve0After, reserve0Before, totalSupplyAfter, totalSupplyBefore, event);
    updateTokenPoolInfo(token1Address, reserve1After, reserve1Before, totalSupplyAfter, totalSupplyBefore, event);
}



export function handleBurn(event: BurnEvent): void {
  //log.info("handleBurn address={}", [event.address.toHexString()]);
  let pairTokens = getPairTokens(event.address);

  if ( !pairTokens.isValid || (!TokenDefinition.fromAddress(pairTokens.token0) && !TokenDefinition.fromAddress(pairTokens.token1))) {
    return
  }

  let entity = new Burn(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.sender = event.params.sender
  entity.amount0 = event.params.amount0
  entity.amount1 = event.params.amount1
  entity.to = event.params.to

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  handlePoolChange(event.address, pairTokens.token0, pairTokens.token1,event);

  
}

export function handleMint(event: MintEvent): void {
  //log.info("handleMint address={}", [event.address.toHexString()]);
  let pairTokens = getPairTokens(event.address);

  if ( !pairTokens.isValid || (!TokenDefinition.fromAddress(pairTokens.token0) && !TokenDefinition.fromAddress(pairTokens.token1))) {
    return
  }


  let entity = new Mint(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.sender = event.params.sender
  entity.amount0 = event.params.amount0
  entity.amount1 = event.params.amount1

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  handlePoolChange(event.address, pairTokens.token0, pairTokens.token1,event);


  

}

export function handleSwap(event: SwapEvent): void {
  //log.info("handleSwap address={}", [event.address.toHexString()]);
  let pairTokens = getPairTokens(event.address);

  if ( !pairTokens.isValid || (!TokenDefinition.fromAddress(pairTokens.token0) && !TokenDefinition.fromAddress(pairTokens.token1))) {
    return
  }



  let entity = new Swap(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.sender = event.params.sender
  entity.amount0In = event.params.amount0In
  entity.amount1In = event.params.amount1In
  entity.amount0Out = event.params.amount0Out
  entity.amount1Out = event.params.amount1Out
  entity.to = event.params.to

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  handlePoolChange(event.address, pairTokens.token0, pairTokens.token1,event);
  
  

}
