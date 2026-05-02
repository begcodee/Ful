// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LandRegistry {
    struct Land {
        uint256 landId;
        address owner;
        string documentHash;
    }

    address public government;

    mapping(uint256 => Land) private lands;

    event LandRegistered(uint256 landId, address owner);
    event LandTransferred(uint256 landId, address oldOwner, address newOwner);

    constructor() {
        government = msg.sender;
    }

    function registerLand(uint256 _landId, string memory _documentHash) external {
        require(_landId != 0, "Invalid land id");
        require(bytes(_documentHash).length > 0, "Empty document hash");
        require(lands[_landId].owner == address(0), "Land already registered");

        lands[_landId] = Land({
            landId: _landId,
            owner: msg.sender,
            documentHash: _documentHash
        });

        emit LandRegistered(_landId, msg.sender);
    }

    function getLand(uint256 _landId) external view returns (uint256, address, string memory) {
        Land memory land = lands[_landId];
        require(land.owner != address(0), "Land not found");
        return (land.landId, land.owner, land.documentHash);
    }

    function transferLand(uint256 _landId, address _newOwner) external {
        require(_newOwner != address(0), "Invalid new owner");

        Land storage land = lands[_landId];
        require(land.owner != address(0), "Land not found");
        require(msg.sender == land.owner || msg.sender == government, "Not authorized");

        address oldOwner = land.owner;
        land.owner = _newOwner;

        emit LandTransferred(_landId, oldOwner, _newOwner);
    }
}
