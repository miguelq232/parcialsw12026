$env:Path = "D:\swp1-main\tools\node-v22.12.0-win-x64;" + $env:Path
& "D:\swp1-main\frontend\node_modules\.bin\ng.cmd" serve --host 0.0.0.0 --port 4200 --proxy-config proxy.conf.json
