"""Q-Learn backend package.

Sets process-wide environment defaults before any submodule (in particular
``app.agents.llm``) imports ``litellm`` — always the first thing that runs
for any ``from app... import ...``, since Python executes a package's
``__init__.py`` before its submodules.
"""
import os

# litellm fetches its model-cost/capability map from GitHub at import time
# unless this is set, using an HTTP client with no request timeout. A slow
# or blocked path to that host hangs the import forever — not just slow,
# unbounded — which previously hung this repo's CI for hours and would do
# the same to the API process at startup in production. The bundled local
# map (refreshed with every litellm version bump, which this project already
# pins a floor for) is more than fresh enough for the usage/cost logging it
# feeds here; nothing user-facing depends on live pricing data. Explicitly
# set `LITELLM_LOCAL_MODEL_COST_MAP=false` in the environment to opt back
# into the network fetch.
os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")
