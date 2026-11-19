# Workflow: Debug Media

1. Run `clipforge doctor` to confirm toolchains and codecs are healthy.
2. Run `clipforge inspect --video <path>` to extract container and stream metadata.
3. Validate stream timestamps, pixel formats, audio sample rates, and sample aspect ratios.
4. If FFmpeg fails, inspect the generated filter graph and spawn arguments.
5. Reproduce with a minimal synthetic fixture before modifying filter builders.
