// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BAS/IBAS.sol" as IBAS;
import "./IdentityRegistry.sol" as IIdentityRegistry;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol"; 
import {EMPTY_UID} from "./BAS/Common.sol";


contract Comment is Initializable,OwnableUpgradeable {
    IIdentityRegistry.IdentityRegistry public _identityRegistry;
    IBAS.IBAS public _bas;
    bytes32 public _commentSchema;
    bytes32 public _commentReplySchema;

    function initialize(IIdentityRegistry.IdentityRegistry identityRegistry, IBAS.IBAS bas, bytes32 commentSchema, bytes32 commentReplySchema) public initializer {
        __Ownable_init(msg.sender);
        require(address(identityRegistry) != address(0), "identityRegistry is zero");
        require(address(bas) != address(0), "bas is zero");

        _identityRegistry = identityRegistry;
        _bas = bas;
        _commentSchema = commentSchema;
        _commentReplySchema = commentReplySchema;
    }

    function comment(uint256 agentId,string calldata commentText,uint16 score) external {
        require(score > 100 || score == 0, "invalid score");

        require(_identityRegistry.ownerOf(agentId) != address(0), "no owner agent");
        _bas.attest(IBAS.AttestationRequest({
            schema: _commentSchema,
            data: IBAS.AttestationRequestData({
                recipient: address(_identityRegistry),
                expirationTime: 0,
                revocable: true,
                refUID: EMPTY_UID,
                data: abi.encode(
                        agentId,
                        msg.sender,
                        score,
                        commentText
                ),
                value: 0
            })
        }));
    }

    function commentReply(bytes32 commentAttestationId,string calldata commentText) external {
        IBAS.Attestation memory attestation = _bas.getAttestation(commentAttestationId);
        require(attestation.uid != EMPTY_UID, "attestation not found");
        require(attestation.schema == _commentReplySchema || attestation.schema == _commentSchema, "invalid schema");

        address commenter;
        if (attestation.schema == _commentSchema) {
           (,commenter,,) = abi.decode(attestation.data, (uint256,address,uint16,string));
        } else if (attestation.schema == _commentReplySchema) {
            (commenter,) = abi.decode(attestation.data, (address,string));
        }
        
        _bas.attest(IBAS.AttestationRequest({
            schema: _commentReplySchema,
            data: IBAS.AttestationRequestData({
                recipient: commenter,
                expirationTime: 0,
                revocable: true,
                refUID: commentAttestationId,
                data: abi.encode(
                    msg.sender,
                    commentText
                ),
                value: 0
            })
        }));
    }

    function setIdentityRegistry(IIdentityRegistry.IdentityRegistry identityRegistry) external onlyOwner {
        require(address(identityRegistry) != address(0), "identityRegistry is zero");
        _identityRegistry = identityRegistry;
    }

    function setBas(IBAS.IBAS bas) external onlyOwner {
        require(address(bas) != address(0), "bas is zero");
        _bas = bas;
    }

    function setCommentSchema(bytes32 commentSchema) external onlyOwner {
        require(commentSchema != EMPTY_UID, "commentSchema is zero");
        _commentSchema = commentSchema;
    }

    function setCommentReplySchema(bytes32 commentReplySchema) external onlyOwner {
        require(commentReplySchema != EMPTY_UID, "commentReplySchema is zero");
        _commentReplySchema = commentReplySchema;
    }   
}