import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployReferralHub: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  await hre.deployments.deploy("ReferralHub", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
  console.log(`ReferralHub deployed by ${deployer}`);
};

export default deployReferralHub;
deployReferralHub.tags = ["ReferralHub"];
