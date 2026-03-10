# MCP Tool Spec

## Proposed tool groups

### setup
- `tax.setup.inspect_environment`
- `tax.setup.init_config`
- `tax.setup.list_connectors`

### sources
- `tax.sources.connect`
- `tax.sources.list`
- `tax.sources.sync`
- `tax.sources.disconnect`

### imports
- `tax.import.upload_transactions`
- `tax.import.upload_documents`
- `tax.import.scan_receipts`
- `tax.import.import_hometax_materials`

### ledger
- `tax.ledger.normalize`
- `tax.ledger.list_transactions`
- `tax.ledger.link_evidence`

### classification
- `tax.classify.run`
- `tax.classify.list_review_items`
- `tax.classify.resolve_review_item`

### filing
- `tax.filing.compute_draft`
- `tax.filing.get_summary`
- `tax.filing.export_package`
- `tax.filing.prepare_hometax`

### browser assist
- `tax.browser.start_hometax_assist`
- `tax.browser.resume_hometax_assist`
- `tax.browser.stop_hometax_assist`

## Tool design rules
- every sensitive action must surface consent state
- every mutating action should produce audit metadata
- review-item resolution must be explicit and attributable
