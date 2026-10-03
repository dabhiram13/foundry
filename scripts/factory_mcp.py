#!/usr/bin/env python3
"""Foundry's local MCP plugin: portable tools plus global and thread UI entrypoints."""
import argparse
from pathlib import Path

from mcp.server.apps import APP_MIME_TYPE, Apps
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.resources import TextResource
from mcp_types import ToolAnnotations
from openai_mcp_extensions import OpenAIExtensions

try:
    from .factory_ui import Service, ROOT
except ImportError:
    from factory_ui import Service, ROOT


def build_server(service):
    apps = Apps()
    apps.add_resource(TextResource(uri='ui://foundry/factory', name='Foundry factory',
        mime_type=APP_MIME_TYPE, text=(ROOT / 'app/panel.html').read_text(),
        meta={'openai/ui': {'preferredDisplayMode':'fullscreen', 'availableDisplayModes':['fullscreen','inline']},
              'ui': {'csp': {'connectDomains': [], 'resourceDomains': []}}}))
    read = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)
    write = ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=False)
    external_read = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=True)
    external_write = ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=True)
    @apps.tool(resource_uri='ui://foundry/factory',
               meta={'openai/ui': {'entrypoints':[{'type':'global'}, {'type':'thread'}]}},
               annotations=read)
    def foundry_open() -> dict:
        """Open the owner's local software factory control panel."""
        return service.snapshot()

    def foundry_snapshot() -> dict:
        """List local products, current stages, saved artifacts, settings and job status."""
        return service.snapshot()

    def foundry_create(name: str, idea: str, adapter: str = 'codex', model: str | None = None,
                       reasoning: str | None = None) -> dict:
        """Create a separate local product workspace from the owner's name and idea. Does not run inference or connect accounts."""
        return service.dispatch('create', dict(name=name, idea=idea, adapter=adapter, model=model, reasoning=reasoning))

    def foundry_run(id: str) -> dict:
        """Run authorized local stages until an owner review or failure. Uses the selected runtime and its account allowance. Never deploys or spends on services."""
        return service.dispatch('run', {'id': id})

    def foundry_artifact(id: str, path: str) -> dict:
        """Read a bounded product document. Paths must stay under that product's docs directory."""
        return service.factory.artifact_record(id, path)

    def foundry_cancel(id: str) -> dict:
        """Request cancellation of an owned local task; the request is not proof it stopped."""
        return service.dispatch('cancel', {'id':id})

    # Only the app exposes owner decisions; agents must never approve their own work.
    @apps.tool(resource_uri='ui://foundry/factory', visibility=['app'], annotations=write)
    def foundry_approve(id: str, reviewed_revision: str) -> dict:
        """Approve the exact scope/design revision the owner reviewed in the app."""
        return service.dispatch('approve', {'id': id, 'reviewed_revision': reviewed_revision})

    @apps.tool(resource_uri='ui://foundry/factory', visibility=['app'], annotations=write)
    def foundry_configure(id: str, adapter: str, model: str | None, reasoning: str | None,
                         roles: dict, subscription_confirmed: bool | None = None) -> dict:
        """Save the owner's runtime and explicit specialist preferences."""
        values = dict(id=id, adapter=adapter, model=model, reasoning=reasoning, roles=roles)
        if subscription_confirmed is not None:
            values['subscription_confirmed'] = subscription_confirmed
        return service.dispatch('configure', values)

    @apps.tool(resource_uri='ui://foundry/factory', visibility=['app'], annotations=external_write)
    def foundry_sign_in() -> dict:
        """Open the owner's browser to request ChatGPT identity and plan-usage consent."""
        return service.dispatch('sign-in', {})

    @apps.tool(resource_uri='ui://foundry/factory', visibility=['app'], annotations=external_write)
    def foundry_sign_out() -> dict:
        """Revoke and clear the owner's Foundry ChatGPT credentials when no jobs are running."""
        return service.dispatch('sign-out', {})

    @apps.tool(resource_uri='ui://foundry/factory', visibility=['app'], annotations=external_read)
    def foundry_models() -> dict:
        """Discover models for the selected ChatGPT account; a completed turn proves access for that request."""
        return {'models': service.dispatch('models', {})}
    server = MCPServer('Foundry', version='0.3.1', extensions=[apps, OpenAIExtensions()],
        instructions='Create and inspect local product workspaces. Scope/design approvals are owner decisions in the app. Never infer account permissions, spend, or publication approval from a completed stage.')
    for fn, annotations in [(foundry_snapshot, read), (foundry_create, write), (foundry_run, external_write), (foundry_artifact, read), (foundry_cancel, write)]:
        server.add_tool(fn, annotations=annotations)
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path)
    parser.add_argument('--products-dir', type=Path)
    args = parser.parse_args()
    service = Service(products_dir=args.products_dir, data_dir=args.data_dir)
    try:
        build_server(service).run('stdio')
    finally:
        service.close()


if __name__ == '__main__':
    main()
