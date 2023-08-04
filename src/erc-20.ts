import {
  Transfer as TransferEvent
} from "../generated/ERC20/ERC20"
import { ERC20Transfer, Token, TokenHistory } from "../generated/schema"
import { TokenDefinition } from "./tokenDefinition"

import { ERC20 as ERC20Contract } from "../generated/ERC20/ERC20";
import { ONE_BI, ZERO_BD, ZERO_BI } from "../const/helpers";
import { BigInt, log } from "@graphprotocol/graph-ts";


export function handleTransfer(event: TransferEvent): void {
  // log.info("handleTransfer address={}, txhash={}, logindex={}", [event.address.toHexString(), event.transaction.hash.toHexString(), event.transactionLogIndex.toString()])
  // if (!TokenDefinition.fromAddress(event.address) ) {
  //   return;
  // }

  let entity = new ERC20Transfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.from = event.params.from
  entity.to = event.params.to
  entity.value = event.params.value

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  let tokenContract = ERC20Contract.bind(event.address);
  let totalSupply = tokenContract.totalSupply();

  let token = Token.load(event.address.toHexString());
  if ( !token ) {
    token = new Token(event.address.toHexString());
    token.poolAmount = ZERO_BI;
    token.totalLiquidity = ZERO_BI;
    token.price = ZERO_BD;
    token.totalHolders = ZERO_BI;
    token.txCount = ZERO_BI;    
    token.totalSupply = ZERO_BI;
  }

  token.totalSupply = totalSupply;
  token.txCount = token.txCount.plus(ONE_BI);
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
