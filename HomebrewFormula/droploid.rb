class Droploid < Formula
  desc "CLI to deploy Flutter & native iOS/Android apps to the App Store & Play Store"
  homepage "https://github.com/mhdibrahimcn/droploid-cli"
  url "https://github.com/mhdibrahimcn/Droploid-_electron/archive/refs/tags/v0.4.2.tar.gz"
  sha256 "3abadb9c458b8b2b17eed3188f9b9913a09ff02bcd8fe230cea74a4ee152e0c0"
  license "MIT"

  depends_on "node"
  depends_on "cocoapods"
  depends_on "fastlane"

  def install
    system "npm", "ci"
    system "npm", "run", "build"
    libexec.install Dir["*"]
    (bin/"droploid").write <<~SH
      #!/bin/bash
      exec "#{libexec}/node_modules/.bin/electron" "#{libexec}/out/main/index.js" --cli "$@"
    SH
  end

  test do
    assert_match "droploid", shell_output("#{bin}/droploid help 2>&1")
  end
end
