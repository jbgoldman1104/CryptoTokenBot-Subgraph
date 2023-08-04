/* eslint-disable prefer-const */
import { log } from '@graphprotocol/graph-ts'
import { PairCreated } from '../generated/Factory/Factory'
import { Pair, Token} from '../generated/schema'
import { Pair as PairTemplate } from '../generated/templates'
import {
  ZERO_BD,
  ZERO_BI
} from '../const/helpers'
import { TokenDefinition } from './tokenDefinition'

export function handleNewPair(event: PairCreated): void {
    if ( !TokenDefinition.fromAddress(event.params.token0) && !TokenDefinition.fromAddress(event.params.token1)) {
        return
    }

  // create the tracked contract based on the template
  PairTemplate.create(event.params.pair)

}
