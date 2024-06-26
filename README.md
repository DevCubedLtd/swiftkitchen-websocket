Using this codebase relies on you having cloud sql proxy working on your machine.
If you have arm mac this is how you do it.

Sorry if you dont

- Download https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-481.0.0-darwin-arm.tar.gz
- Extract it
- Run the install script
- In a terminal, run gcloud auth application-default login and follow the instructions to put an API token onto your local machine
- In the terminal, download the proxy `curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.4/cloud-sql-proxy.darwin.arm64`
- Make it executable with `chmod +x cloud-sql-proxy`
- Run `./cloud-sql-proxy swiftkitchen:europe-west1:staging-api`

Then make an env file with the same db details as within the VPS. If you cant access that you
probably shouldn't be here. Ask for access.
