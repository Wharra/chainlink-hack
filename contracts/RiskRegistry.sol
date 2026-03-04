// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RiskRegistry — ChainGuard on-chain risk ledger
/// @notice Stores risk scores reported by Antigravity via Chainlink CRE
contract RiskRegistry {

    struct RiskEntry {
        uint256 score;
        string  vulnerability;
        uint256 timestamp;
        address reporter;
    }

    mapping(address => RiskEntry) public risks;
    address[] public flaggedContracts;

    event RiskReported(
        address indexed target,
        uint256 score,
        string  vulnerability,
        address indexed reporter
    );

    /// @notice Report a risk score for a contract (called by Chainlink CRE)
    function reportRisk(
        address target,
        uint256 score,
        string calldata vulnerability
    ) external {
        require(target != address(0), "Invalid target");
        require(score <= 100,         "Score out of range");

        bool isNew = risks[target].timestamp == 0;
        risks[target] = RiskEntry({
            score:         score,
            vulnerability: vulnerability,
            timestamp:     block.timestamp,
            reporter:      msg.sender
        });

        if (isNew && score >= 70) {
            flaggedContracts.push(target);
        }

        emit RiskReported(target, score, vulnerability, msg.sender);
    }

    /// @notice Get risk data for a contract
    function getRisk(address target)
        external view
        returns (uint256 score, string memory vulnerability, uint256 timestamp)
    {
        RiskEntry memory e = risks[target];
        return (e.score, e.vulnerability, e.timestamp);
    }

    /// @notice Number of flagged (high-risk) contracts
    function flaggedCount() external view returns (uint256) {
        return flaggedContracts.length;
    }
}
