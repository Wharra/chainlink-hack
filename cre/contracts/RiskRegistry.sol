// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RiskRegistry {
    struct RiskReport {
        uint256 score;
        string vulnerability;
        uint256 timestamp;
    }

    mapping(address => RiskReport) public reports;

    event RiskReported(address indexed target, uint256 score, string vulnerability, uint256 timestamp);

    function reportRisk(address target, uint256 score, string calldata vulnerability) external {
        reports[target] = RiskReport({
            score: score,
            vulnerability: vulnerability,
            timestamp: block.timestamp
        });

        emit RiskReported(target, score, vulnerability, block.timestamp);
    }
}
