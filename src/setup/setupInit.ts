// Copyright 2019 Espressif Systems (Shanghai) CO LTD
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  ConfigurationTarget,
  Progress,
  Uri,
  window,
  WorkspaceFolder,
} from "vscode";
import { IdfToolsManager } from "../idfToolsManager";
import * as utils from "../utils";
import { getEspIdfTags, getEspIdfVersions } from "./espIdfVersionList";
import { IdfSetup, IEspIdfLink } from "../views/setup/types";
import { getPythonList } from "./installPyReqs";
import { pathExists } from "fs-extra";
import path from "path";
import { Logger } from "../logger/logger";
import * as idfConf from "../idfConfiguration";
import { getPropertyFromJson, getSelectedIdfInstalled } from "./espIdfJson";
import {
  createIdfSetup,
  getPreviousIdfSetups,
  loadIdfSetupsFromEspIdfJson,
} from "./existingIdfSetups";
import { checkPyVenv } from "./setupValidation/pythonEnv";

export interface ISetupInitArgs {
  espIdfPath: string;
  espToolsPath: string;
  existingIdfSetups: IdfSetup[];
  espIdfVersionsList: IEspIdfLink[];
  espIdfTagsList: IEspIdfLink[];
  gitPath: string;
  gitVersion: string;
  hasPrerequisites: boolean;
  onReqPkgs?: string[];
  pythonVersions: string[];
}

export interface IPreviousInstallResult {
  espIdfPath: string;
  toolsPath: string;
  gitPath: string;
  gitVersion: string;
  existingIdfSetups: IdfSetup[];
}

export interface IExistingSetup {}

export async function checkPreviousInstall(
  workspaceFolder: Uri
): Promise<IPreviousInstallResult> {
  const containerPath =
    process.platform === "win32" ? process.env.USERPROFILE : process.env.HOME;

  const confEspIdfPath = idfConf.readParameter(
    "idf.espIdfPath",
    workspaceFolder
  ) as string;
  const confToolsPath = idfConf.readParameter(
    "idf.toolsPath",
    workspaceFolder
  ) as string;

  const toolsPath =
    confToolsPath ||
    process.env.IDF_TOOLS_PATH ||
    path.join(containerPath, ".espressif");
  let espIdfPath =
    confEspIdfPath ||
    process.env.IDF_PATH ||
    path.join(containerPath, "esp", "esp-idf");

  let idfPathExists = await pathExists(espIdfPath);
  if (!idfPathExists && process.platform === "win32") {
    espIdfPath = path.join(process.env.USERPROFILE, "Desktop", "esp-idf");
  }

  const espIdfJsonPath = path.join(toolsPath, "esp_idf.json");
  const espIdfJsonExists = await pathExists(espIdfJsonPath);
  let gitPath =
    idfConf.readParameter("idf.gitPath", workspaceFolder) || "/usr/bin/git";
  let existingIdfSetups: IdfSetup[] = [];
  if (espIdfJsonExists) {
    const idfInstalled = await getSelectedIdfInstalled(toolsPath);
    if (idfInstalled && idfInstalled.path) {
      espIdfPath = idfInstalled.path;
    }
    const gitPathFromJson = (await getPropertyFromJson(
      toolsPath,
      "gitPath"
    )) as string;
    const gitPathExists = await pathExists(gitPathFromJson);
    if (gitPathExists) {
      gitPath = gitPathFromJson;
    }
    existingIdfSetups = await loadIdfSetupsFromEspIdfJson(toolsPath);
  }

  const gitVersion = await utils.checkGitExists(containerPath, gitPath);

  return {
    espIdfPath,
    toolsPath,
    gitPath,
    gitVersion,
    existingIdfSetups,
  };
}

export async function getSetupInitialValues(
  extensionPath: string,
  progress: Progress<{ message: string; increment: number }>,
  workspaceFolder: Uri
) {
  progress.report({ increment: 20, message: "Getting ESP-IDF versions..." });
  const espIdfVersionsList = await getEspIdfVersions(extensionPath);
  progress.report({ increment: 10, message: "Getting ESP-IDF Tags" });
  const espIdfTagsList = await getEspIdfTags();
  progress.report({ increment: 10, message: "Getting Python versions..." });
  const pythonVersions = await getPythonList(extensionPath);
  const idfSetups = await getPreviousIdfSetups(false);
  const setupInitArgs = {
    espIdfVersionsList,
    espIdfTagsList,
    existingIdfSetups: idfSetups,
    pythonVersions,
  } as ISetupInitArgs;

  try {
    progress.report({
      increment: 10,
      message: "Checking for previous install...",
    });

    // Get initial paths
    const prevInstall = await checkPreviousInstall(workspaceFolder);
    if (process.platform !== "win32") {
      setupInitArgs.hasPrerequisites =
        prevInstall.gitVersion !== "Not found" &&
        pythonVersions &&
        pythonVersions.length > 0;

      const canAccessCMake = await utils.isBinInPath(
        "cmake",
        extensionPath,
        process.env
      );

      if (canAccessCMake === "") {
        setupInitArgs.onReqPkgs = setupInitArgs.onReqPkgs
          ? [...setupInitArgs.onReqPkgs, "cmake"]
          : ["cmake"];
      }

      const canAccessNinja = await utils.isBinInPath(
        "ninja",
        extensionPath,
        process.env
      );

      if (canAccessNinja === "") {
        setupInitArgs.onReqPkgs = setupInitArgs.onReqPkgs
          ? [...setupInitArgs.onReqPkgs, "ninja"]
          : ["ninja"];
      }
    } else {
      setupInitArgs.hasPrerequisites = true;
    }
    progress.report({ increment: 20, message: "Preparing setup view..." });
    if (prevInstall) {
      setupInitArgs.espIdfPath = prevInstall.espIdfPath;
      setupInitArgs.espToolsPath = prevInstall.toolsPath;
      setupInitArgs.gitPath = prevInstall.gitPath;
      setupInitArgs.gitVersion = prevInstall.gitVersion;
      if (prevInstall.existingIdfSetups) {
        for (let espIdfJsonSetup of prevInstall.existingIdfSetups) {
          const alreadyInExtensionSetup = idfSetups.find((s) => {
            return s.idfPath === espIdfJsonSetup.idfPath;
          });
          if (typeof alreadyInExtensionSetup === "undefined") {
            setupInitArgs.existingIdfSetups.push(espIdfJsonSetup);
          }
        }
      }
    }
  } catch (error) {
    Logger.error(error.message, error);
  }
  return setupInitArgs;
}

function updateCustomExtraVars(workspaceFolder: Uri) {
  const extraVars = idfConf.readParameter(
    "idf.customExtraVars",
    workspaceFolder
  );
  if (typeof extraVars === "string") {
    try {
      const extraVarsObj = JSON.parse(extraVars);
      const target = idfConf.readParameter("idf.saveScope");
      idfConf.writeParameter(
        "idf.customExtraVars",
        extraVarsObj,
        target,
        workspaceFolder
      );
    } catch (err) {
      const msg = err.message
        ? err.message
        : "Error changing idf.customExtraVars from string to object";
      Logger.errorNotify(msg, err);
    }
  }
}

export async function isCurrentInstallValid(workspaceFolder: Uri) {
  const containerPath =
    process.platform === "win32" ? process.env.USERPROFILE : process.env.HOME;
  const confToolsPath = idfConf.readParameter(
    "idf.toolsPath",
    workspaceFolder
  ) as string;
  const toolsPath =
    confToolsPath ||
    process.env.IDF_TOOLS_PATH ||
    path.join(containerPath, ".espressif");
  const extraPaths = idfConf.readParameter(
    "idf.customExtraPaths",
    workspaceFolder
  ) as string;
  const pythonBinPath = idfConf.readParameter(
    "idf.pythonBinPath",
    workspaceFolder
  ) as string;

  // FIX idf.customExtraVars from string to object
  // REMOVE THIS LINE after next release
  updateCustomExtraVars(workspaceFolder);

  let espIdfPath = idfConf.readParameter("idf.espIdfPath", workspaceFolder);
  let idfPathVersion = await utils.getEspIdfFromCMake(espIdfPath);
  if (idfPathVersion === "x.x" && process.platform === "win32") {
    espIdfPath = path.join(process.env.USERPROFILE, "Desktop", "esp-idf");
    idfPathVersion = await utils.getEspIdfFromCMake(espIdfPath);
  }
  if (idfPathVersion === "x.x") {
    return false;
  }
  const idfToolsManager = await IdfToolsManager.createIdfToolsManager(
    espIdfPath
  );
  let extraReqPaths = [];
  if (process.platform !== "win32") {
    const canAccessCMake = await utils.isBinInPath(
      "cmake",
      containerPath,
      process.env
    );
    if (!canAccessCMake) {
      extraReqPaths.push("cmake");
    }
    const canAccessNinja = await utils.isBinInPath(
      "ninja",
      containerPath,
      process.env
    );
    if (!canAccessNinja) {
      extraReqPaths.push("ninja");
    }
  }
  const toolsInfo = await idfToolsManager.getRequiredToolsInfo(
    path.join(toolsPath, "tools"),
    extraPaths,
    extraReqPaths,
    false
  );
  const failedToolsResult = toolsInfo.filter(
    (tInfo) =>
      tInfo.actual.indexOf("No match") !== -1 &&
      tInfo.actual.indexOf("Error") !== -1
  );

  if (failedToolsResult.length !== 0) {
    return false;
  }
  const isPyEnvValid = await checkPyVenv(pythonBinPath, espIdfPath);
  return isPyEnvValid;
}

export async function saveSettings(
  espIdfPath: string,
  pythonBinPath: string,
  exportedPaths: string,
  exportedVars: { [key: string]: string },
  toolsPath: string,
  gitPath: string,
  saveScope: ConfigurationTarget
) {
  const confTarget =
    saveScope ||
    (idfConf.readParameter("idf.saveScope") as ConfigurationTarget);
  let workspaceFolder: WorkspaceFolder;
  if (confTarget === ConfigurationTarget.WorkspaceFolder) {
    workspaceFolder = await window.showWorkspaceFolderPick({
      placeHolder: `Pick Workspace Folder to which settings should be applied`,
    });
  }
  await idfConf.writeParameter(
    "idf.espIdfPath",
    espIdfPath,
    confTarget,
    workspaceFolder ? workspaceFolder.uri : undefined
  );
  await idfConf.writeParameter(
    "idf.pythonBinPath",
    pythonBinPath,
    confTarget,
    workspaceFolder ? workspaceFolder.uri : undefined
  );
  await idfConf.writeParameter(
    "idf.toolsPath",
    toolsPath,
    confTarget,
    workspaceFolder ? workspaceFolder.uri : undefined
  );
  await idfConf.writeParameter(
    "idf.customExtraPaths",
    exportedPaths,
    confTarget,
    workspaceFolder ? workspaceFolder.uri : undefined
  );
  await idfConf.writeParameter(
    "idf.customExtraVars",
    exportedVars,
    confTarget,
    workspaceFolder ? workspaceFolder.uri : undefined
  );
  await idfConf.writeParameter(
    "idf.gitPath",
    gitPath,
    confTarget,
    workspaceFolder ? workspaceFolder.uri : undefined
  );
  await createIdfSetup(espIdfPath, toolsPath, pythonBinPath, gitPath);
  window.showInformationMessage("ESP-IDF has been configured");
}
