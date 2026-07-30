#!/bin/bash
# Run Planillas Backend locally
export LD_LIBRARY_PATH=/home/hikki/.local/lib:$LD_LIBRARY_PATH
export TESSDATA_PREFIX=/home/hikki/.local/share/tessdata
export $(grep -v '^#' /home/hikki/Documentos/RSU/ugelaa/backend/.env | xargs)

cd /home/hikki/Documentos/RSU/ugelaa/backend
exec ./server
