/**
 * This source code is licensed under the MIT license found in the
 * LICENSE-MIT file in the root directory of this source tree.
 */

#include "RNOH/PackageProvider.h"
#include "RNOHPackagesFactory.h"

using namespace rnoh;

std::vector<std::shared_ptr<Package>> PackageProvider::getPackages(Package::Context ctx) {
    const std::vector<std::shared_ptr<Package>> ManualLinkingPackage = {
    };

    auto packages = createRNOHPackages(ctx);

    for (const auto &pkg : ManualLinkingPackage) {
        packages.push_back(pkg);
    }
    return packages;
}
