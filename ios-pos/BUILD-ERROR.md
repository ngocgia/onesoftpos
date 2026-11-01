# Log lỗi build lúc 2026-11-01 10:25 UTC

```
Command line invocation:
    /Applications/Xcode_16.4.app/Contents/Developer/usr/bin/xcodebuild -project OnesoftPOS.xcodeproj -target OnesoftPOS -configuration Release -sdk iphoneos SYMROOT=/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY= build

Build settings from command line:
    CODE_SIGN_IDENTITY = 
    CODE_SIGNING_ALLOWED = NO
    CODE_SIGNING_REQUIRED = NO
    SDKROOT = iphoneos18.5
    SYMROOT = /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build

note: Using codesigning identity override: 
ComputePackagePrebuildTargetDependencyGraph

Prepare packages

CreateBuildRequest

SendProjectDescription

CreateBuildOperation

ComputeTargetDependencyGraph
note: Building targets in dependency order
note: Target dependency graph (1 target)
    Target 'OnesoftPOS' in project 'OnesoftPOS' (no dependencies)

GatherProvisioningInputs

CreateBuildDescription

ExecuteExternalTool /Applications/Xcode_16.4.app/Contents/Developer/usr/bin/actool --print-asset-tag-combinations --output-format xml1 /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/Assets.xcassets

ExecuteExternalTool /Applications/Xcode_16.4.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang -v -E -dM -isysroot /Applications/Xcode_16.4.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS18.5.sdk -x c -c /dev/null

ExecuteExternalTool /Applications/Xcode_16.4.app/Contents/Developer/usr/bin/actool --version --output-format xml1

ExecuteExternalTool /Applications/Xcode_16.4.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swiftc --version

ExecuteExternalTool /Applications/Xcode_16.4.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/ld -version_details

Build description signature: 049def03418d8cc2f9474de016b055db
Build description path: /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/XCBuildData/049def03418d8cc2f9474de016b055db.xcbuilddata
CreateBuildDirectory /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS.xcodeproj
    builtin-create-build-directory /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build

ClangStatCache /Applications/Xcode_16.4.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang-stat-cache /Applications/Xcode_16.4.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS18.5.sdk /var/folders/y3/p6x0rn5562l5qyxy7x6jqrsc0000gn/C/com.apple.DeveloperTools/16.4-16F6/Xcode/SDKStatCaches.noindex/iphoneos18.5-22F76-a529daf784b3616c7c04a36aeb7f5c05.sdkstatcache
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS.xcodeproj
    /Applications/Xcode_16.4.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang-stat-cache /Applications/Xcode_16.4.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS18.5.sdk -o /var/folders/y3/p6x0rn5562l5qyxy7x6jqrsc0000gn/C/com.apple.DeveloperTools/16.4-16F6/Xcode/SDKStatCaches.noindex/iphoneos18.5-22F76-a529daf784b3616c7c04a36aeb7f5c05.sdkstatcache

CreateBuildDirectory /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS.xcodeproj
    builtin-create-build-directory /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS-4c3b969a82eb9f559a364b9877034419-VFS-iphoneos/all-product-headers.yaml
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS.xcodeproj
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS-4c3b969a82eb9f559a364b9877034419-VFS-iphoneos/all-product-headers.yaml

CreateBuildDirectory /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/EagerLinkingTBDs/Release-iphoneos
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS.xcodeproj
    builtin-create-build-directory /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/EagerLinkingTBDs/Release-iphoneos

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS.hmap (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS.hmap

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS.DependencyStaticMetadataFileList (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS.DependencyStaticMetadataFileList

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS.DependencyMetadataFileList (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS.DependencyMetadataFileList

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-project-headers.hmap (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-project-headers.hmap

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-own-target-headers.hmap (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-own-target-headers.hmap

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-generated-files.hmap (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-generated-files.hmap

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-all-target-headers.hmap (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-all-target-headers.hmap

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-all-non-framework-target-headers.hmap (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-all-non-framework-target-headers.hmap

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS_const_extract_protocols.json (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS_const_extract_protocols.json

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS.SwiftFileList (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS.SwiftFileList

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS.SwiftConstValuesFileList (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS.SwiftConstValuesFileList

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS.LinkFileList (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS.LinkFileList

WriteAuxiliaryFile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS-OutputFileMap.json (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    write-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS-OutputFileMap.json

MkDir /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos/OnesoftPOS.app (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    /bin/mkdir -p /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos/OnesoftPOS.app

MkDir /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/assetcatalog_output/unthinned (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    /bin/mkdir -p /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/assetcatalog_output/unthinned

MkDir /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/assetcatalog_output/thinned (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    /bin/mkdir -p /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/assetcatalog_output/thinned

GenerateAssetSymbols /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/Assets.xcassets (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    /Applications/Xcode_16.4.app/Contents/Developer/usr/bin/actool /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/Assets.xcassets --compile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos/OnesoftPOS.app --output-format human-readable-text --notices --warnings --export-dependency-info /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/assetcatalog_dependencies --output-partial-info-plist /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/assetcatalog_generated_info.plist --app-icon AppIcon --compress-pngs --enable-on-demand-resources YES --development-region vi --target-device iphone --minimum-deployment-target 15.0 --platform iphoneos --bundle-identifier vn.pro.giavdn.onesoftpos --generate-swift-asset-symbol-extensions NO --generate-swift-asset-symbols /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources/GeneratedAssetSymbols.swift --generate-objc-asset-symbols /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources/GeneratedAssetSymbols.h --generate-asset-symbol-index /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources/GeneratedAssetSymbols-Index.plist
/* com.apple.actool.compilation-results */
/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources/GeneratedAssetSymbols-Index.plist
/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources/GeneratedAssetSymbols.h
/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources/GeneratedAssetSymbols.swift


CpResource /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos/OnesoftPOS.app/receipt-snapshot.js /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/receipt-snapshot.js (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    builtin-copy -exclude .DS_Store -exclude CVS -exclude .svn -exclude .git -exclude .hg -resolve-src-symlinks /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/receipt-snapshot.js /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos/OnesoftPOS.app

CompileAssetCatalogVariant thinned /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos/OnesoftPOS.app /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/Assets.xcassets (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    /Applications/Xcode_16.4.app/Contents/Developer/usr/bin/actool /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/Assets.xcassets --compile /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/assetcatalog_output/thinned --output-format human-readable-text --notices --warnings --export-dependency-info /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/assetcatalog_dependencies_thinned --output-partial-info-plist /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/assetcatalog_generated_info.plist_thinned --app-icon AppIcon --compress-pngs --enable-on-demand-resources YES --development-region vi --target-device iphone --minimum-deployment-target 15.0 --platform iphoneos

SwiftDriver OnesoftPOS normal arm64 com.apple.xcode.tools.swift.compiler (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    builtin-SwiftDriver -- /Applications/Xcode_16.4.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swiftc -module-name OnesoftPOS -O -whole-module-optimization -enforce-exclusivity\=checked @/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS.SwiftFileList -enable-bare-slash-regex -enable-experimental-feature DebugDescriptionMacro -sdk /Applications/Xcode_16.4.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS18.5.sdk -target arm64-apple-ios15.0 -g -Xfrontend -serialize-debugging-options -swift-version 5 -I /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos -F /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos -c -num-threads 3 -Xcc -ivfsstatcache -Xcc /var/folders/y3/p6x0rn5562l5qyxy7x6jqrsc0000gn/C/com.apple.DeveloperTools/16.4-16F6/Xcode/SDKStatCaches.noindex/iphoneos18.5-22F76-a529daf784b3616c7c04a36aeb7f5c05.sdkstatcache -output-file-map /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS-OutputFileMap.json -use-frontend-parseable-output -save-temps -no-color-diagnostics -serialize-diagnostics -emit-dependencies -emit-module -emit-module-path /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS.swiftmodule -validate-clang-modules-once -clang-build-session-file /var/folders/y3/p6x0rn5562l5qyxy7x6jqrsc0000gn/C/org.llvm.clang/ModuleCache.noindex/Session.modulevalidation -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/swift-overrides.hmap -emit-const-values -Xfrontend -const-gather-protocols-file -Xfrontend /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS_const_extract_protocols.json -Xcc -iquote -Xcc /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-generated-files.hmap -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-own-target-headers.hmap -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-all-target-headers.hmap -Xcc -iquote -Xcc /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-project-headers.hmap -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos/include -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources-normal/arm64 -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources/arm64 -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources -emit-objc-header -emit-objc-header-path /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS-Swift.h -working-directory /Users/runner/work/onesoftpos/onesoftpos/ios-pos -no-emit-module-separately-wmo

SwiftCompile normal arm64 Compiling\ AppDelegate.swift,\ ViewController.swift,\ NativeSpeaker.swift,\ EscPosRaster.swift,\ PrinterNetworkAddress.swift,\ ReceiptRenderer.swift,\ ThermalPrinter.swift,\ BitmapPixels.swift,\ GeneratedAssetSymbols.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/AppDelegate.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ViewController.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/NativeSpeaker.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/EscPosRaster.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/PrinterNetworkAddress.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ReceiptRenderer.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ThermalPrinter.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/BitmapPixels.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources/GeneratedAssetSymbols.swift (in target 'OnesoftPOS' from project 'OnesoftPOS')
Failed frontend command:
/Applications/Xcode_16.4.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift-frontend -frontend -c /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/AppDelegate.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ViewController.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/NativeSpeaker.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/EscPosRaster.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/PrinterNetworkAddress.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ReceiptRenderer.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ThermalPrinter.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/BitmapPixels.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources/GeneratedAssetSymbols.swift -supplementary-output-file-map /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/supplementaryOutputs-1 -target arm64-apple-ios15.0 -Xllvm -aarch64-use-tbi -enable-objc-interop -stack-check -sdk /Applications/Xcode_16.4.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS18.5.sdk -I /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos -F /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos -no-color-diagnostics -g -debug-info-format\=dwarf -dwarf-version\=4 -swift-version 5 -enforce-exclusivity\=checked -O -serialize-debugging-options -const-gather-protocols-file /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS_const_extract_protocols.json -enable-experimental-feature DebugDescriptionMacro -enable-bare-slash-regex -empty-abi-descriptor -validate-clang-modules-once -clang-build-session-file /var/folders/y3/p6x0rn5562l5qyxy7x6jqrsc0000gn/C/org.llvm.clang/ModuleCache.noindex/Session.modulevalidation -Xcc -working-directory -Xcc /Users/runner/work/onesoftpos/onesoftpos/ios-pos -resource-dir /Applications/Xcode_16.4.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/swift -file-compilation-dir /Users/runner/work/onesoftpos/onesoftpos/ios-pos -Xcc -ivfsstatcache -Xcc /var/folders/y3/p6x0rn5562l5qyxy7x6jqrsc0000gn/C/com.apple.DeveloperTools/16.4-16F6/Xcode/SDKStatCaches.noindex/iphoneos18.5-22F76-a529daf784b3616c7c04a36aeb7f5c05.sdkstatcache -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/swift-overrides.hmap -Xcc -iquote -Xcc /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-generated-files.hmap -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-own-target-headers.hmap -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-all-target-headers.hmap -Xcc -iquote -Xcc /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-project-headers.hmap -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos/include -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources-normal/arm64 -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources/arm64 -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources -module-name OnesoftPOS -frontend-parseable-output -disable-clang-spi -target-sdk-version 18.5 -target-sdk-name iphoneos18.5 -external-plugin-path /Applications/Xcode_16.4.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/usr/lib/swift/host/plugins\#/Applications/Xcode_16.4.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/usr/bin/swift-plugin-server -external-plugin-path /Applications/Xcode_16.4.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/usr/local/lib/swift/host/plugins\#/Applications/Xcode_16.4.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/usr/bin/swift-plugin-server -in-process-plugin-server-path /Applications/Xcode_16.4.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/swift/host/libSwiftInProcPluginServer.dylib -plugin-path /Applications/Xcode_16.4.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/swift/host/plugins -plugin-path /Applications/Xcode_16.4.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/local/lib/swift/host/plugins -enable-default-cmo -num-threads 3 -o /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/AppDelegate.o -o /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/ViewController.o -o /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/NativeSpeaker.o -o /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/EscPosRaster.o -o /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/PrinterNetworkAddress.o -o /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/ReceiptRenderer.o -o /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/ThermalPrinter.o -o /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/BitmapPixels.o -o /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/GeneratedAssetSymbols.o -index-unit-output-path /OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/AppDelegate.o -index-unit-output-path /OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/ViewController.o -index-unit-output-path /OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/NativeSpeaker.o -index-unit-output-path /OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/EscPosRaster.o -index-unit-output-path /OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/PrinterNetworkAddress.o -index-unit-output-path /OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/ReceiptRenderer.o -index-unit-output-path /OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/ThermalPrinter.o -index-unit-output-path /OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/BitmapPixels.o -index-unit-output-path /OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/GeneratedAssetSymbols.o

CompileSwift normal arm64 (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    
/Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ViewController.swift:323:49: warning: left side of nil coalescing operator '??' has non-optional type 'UIPrintInfo', so the right side is never used
        let info = UIPrintInfo(dictionary: nil) ?? UIPrintInfo()
                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~
                                               
/Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ReceiptRenderer.swift:145:1: error: cannot declare conformance to 'NSObjectProtocol' in Swift; 'ReceiptRenderer' should inherit 'NSObject' instead
extension ReceiptRenderer: WKNavigationDelegate {
^
/Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ReceiptRenderer.swift:145:1: note: add stubs for conformance
extension ReceiptRenderer: WKNavigationDelegate {
^
/Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ThermalPrinter.swift:248:54: error: no exact matches in call to initializer 
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: CGFloat(height)), format: format)
                                                     ^
/Applications/Xcode_16.4.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS18.5.sdk/System/Library/Frameworks/CoreFoundation.framework/Headers/CFCGTypes.h:58:8: note: candidate expects value of type 'CGFloat' for parameter #1 (got 'Int')
struct CGSize {
       ^
CoreGraphics.CGSize.init:2:8: note: candidate expects value of type 'Int' for parameter #2 (got 'CGFloat')
public init(width: Int, height: Int)}
       ^
/Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ThermalPrinter.swift:273:58: error: no exact matches in call to initializer 
            let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: CGFloat(rows)), format: format)
                                                         ^
/Applications/Xcode_16.4.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS18.5.sdk/System/Library/Frameworks/CoreFoundation.framework/Headers/CFCGTypes.h:58:8: note: candidate expects value of type 'CGFloat' for parameter #1 (got 'Int')
struct CGSize {
       ^
CoreGraphics.CGSize.init:2:8: note: candidate expects value of type 'Int' for parameter #2 (got 'CGFloat')
public init(width: Int, height: Int)}
       ^

SwiftDriver\ Compilation OnesoftPOS normal arm64 com.apple.xcode.tools.swift.compiler (in target 'OnesoftPOS' from project 'OnesoftPOS')
    cd /Users/runner/work/onesoftpos/onesoftpos/ios-pos
    builtin-Swift-Compilation -- /Applications/Xcode_16.4.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swiftc -module-name OnesoftPOS -O -whole-module-optimization -enforce-exclusivity\=checked @/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS.SwiftFileList -enable-bare-slash-regex -enable-experimental-feature DebugDescriptionMacro -sdk /Applications/Xcode_16.4.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS18.5.sdk -target arm64-apple-ios15.0 -g -Xfrontend -serialize-debugging-options -swift-version 5 -I /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos -F /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos -c -num-threads 3 -Xcc -ivfsstatcache -Xcc /var/folders/y3/p6x0rn5562l5qyxy7x6jqrsc0000gn/C/com.apple.DeveloperTools/16.4-16F6/Xcode/SDKStatCaches.noindex/iphoneos18.5-22F76-a529daf784b3616c7c04a36aeb7f5c05.sdkstatcache -output-file-map /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS-OutputFileMap.json -use-frontend-parseable-output -save-temps -no-color-diagnostics -serialize-diagnostics -emit-dependencies -emit-module -emit-module-path /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS.swiftmodule -validate-clang-modules-once -clang-build-session-file /var/folders/y3/p6x0rn5562l5qyxy7x6jqrsc0000gn/C/org.llvm.clang/ModuleCache.noindex/Session.modulevalidation -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/swift-overrides.hmap -emit-const-values -Xfrontend -const-gather-protocols-file -Xfrontend /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS_const_extract_protocols.json -Xcc -iquote -Xcc /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-generated-files.hmap -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-own-target-headers.hmap -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-all-target-headers.hmap -Xcc -iquote -Xcc /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/OnesoftPOS-project-headers.hmap -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/Release-iphoneos/include -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources-normal/arm64 -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources/arm64 -Xcc -I/Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources -emit-objc-header -emit-objc-header-path /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/Objects-normal/arm64/OnesoftPOS-Swift.h -working-directory /Users/runner/work/onesoftpos/onesoftpos/ios-pos -no-emit-module-separately-wmo

** BUILD FAILED **


The following build commands failed:
	SwiftCompile normal arm64 Compiling\ AppDelegate.swift,\ ViewController.swift,\ NativeSpeaker.swift,\ EscPosRaster.swift,\ PrinterNetworkAddress.swift,\ ReceiptRenderer.swift,\ ThermalPrinter.swift,\ BitmapPixels.swift,\ GeneratedAssetSymbols.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/AppDelegate.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ViewController.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/NativeSpeaker.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/EscPosRaster.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/PrinterNetworkAddress.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ReceiptRenderer.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/ThermalPrinter.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/OnesoftPOS/BitmapPixels.swift /Users/runner/work/onesoftpos/onesoftpos/ios-pos/build/OnesoftPOS.build/Release-iphoneos/OnesoftPOS.build/DerivedSources/GeneratedAssetSymbols.swift (in target 'OnesoftPOS' from project 'OnesoftPOS')
	CompileSwift normal arm64 (in target 'OnesoftPOS' from project 'OnesoftPOS')
(2 failures)
```
