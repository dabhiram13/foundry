---
name: product-foundry
description: Start a new product or add Product Foundry to an existing project when the owner requests Product Foundry, taking care of framework installation and application checks through conversation.
---

# Product Foundry

The framework checkout is `{{FRAMEWORK_ROOT}}`. Read its `docs/WORKFLOW.md` before
setup. This checkout supplies the installer and reusable skills; build application
code in the product's own workspace.

1. Read the product name, idea, and current workspace instructions. Continue in an
   existing product when the owner asks to work there. For a new product, use a
   lowercase folder name derived from the product name and create it beside the
   framework checkout by default. Follow any location the owner already supplied;
   ask about location only when the intended project is ambiguous. Tell the owner
   the selected location in plain language. Ask for a name if none was supplied.
2. Run the framework's `scripts/foundry.py install` with the internally resolved
   absolute product folder. For a product with `.foundry/install.json`, use its
   installed runtime and resume existing work; apply updates only when requested.
   If a proposed new folder already contains a project, clarify whether to continue
   it or choose another name. Preserve its files and instructions.
3. Match the next step to the request. For installation-only requests, report the
   installation and stop, preserving the application's stack and configuration.
   If the owner also requests check setup or product work, read the installed
   `docs/WORKFLOW.md` and work within that scope. Keep an existing application's
   stack; choose a stack for a new product from the owner's preferences. Use the
   installed runtime to track, verify, and complete requested product work. Select
   the appropriate skills and run the commands yourself.
4. Follow the workflow's check-configuration step after inspecting or creating the
   application. Handle the configuration yourself; ask the owner about product
   decisions rather than filesystem paths or JSON syntax.
5. Report the product folder and actual results. Opening that folder as a separate
   Codex workspace may require a UI step. Preserve native hook review and existing
   authorization for external services, publishing, and spending.

If the framework checkout is unavailable, explain that the local connection needs
to be re-established from the framework's current location. Do not fetch a substitute
framework or change unrelated projects.
