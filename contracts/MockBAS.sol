// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { AttestationRequest } from "./BAS/IBAS.sol";

/// @notice Test-only stand-in for the BAS contract. It records how many attestations were requested.
contract MockBAS {
    uint256 public attestCount;

    function attest(AttestationRequest calldata request) external payable returns (bytes32) {
        attestCount += 1;
        return keccak256(abi.encode(request.schema, attestCount));
    }
}
