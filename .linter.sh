#!/bin/bash
cd /home/kavia/workspace/code-generation/cyberrecon-suite-26393-aec3d6ad/cyberrecon_suite
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

