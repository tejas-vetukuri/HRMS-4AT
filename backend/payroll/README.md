# Payroll App

Payroll module for the HRMS system, providing foundational payroll configuration.

## Dependencies

This app requires Phase 0 Django scaffolding to be in place:
- `manage.py` and `settings.py` must exist
- The following core apps must be registered in `INSTALLED_APPS`:
  - `accounts`
  - `employees`
  - `approvals`
  - `audit`
  - `documents`
  - `core`
- PostgreSQL database configured in settings
- `rest_framework` and `rest_framework.authtoken` registered

Once the project is scaffolded, register this app in `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # ...
    'payroll',
    # ...
]
```

And include its URLs in the root URLconf:

```python
urlpatterns = [
    # ...
    path('api/v1/payroll/', include('payroll.urls')),
    # ...
]
```

## Models

The app provides 8 models covering payroll setup configuration:

1. **LegalEntity** — Company/subsidiary information for tax filings
2. **PaySchedule** — Payroll cycle definitions (frequency, pay dates, cutoffs)
3. **StatutoryConfig** — Statutory contributions enrollment (PF, ESI, LWF, Professional Tax)
4. **SalaryComponent** — Earnings and deduction line items (Basic, HRA, DA, PF Deduction, etc.)
5. **SalaryStructure** — Salary bands and their component composition
6. **SalaryStructureComponent** — Through-table linking components to structures with overrides
7. **TaxFilingConfig** — Tax jurisdiction configuration per legal entity
8. **PayStubTemplate** — Branding and layout rules for generated payslips
9. **PayGroup** — Organizational grouping for payroll approval assignment

All models include `created_at`/`updated_at` timestamps and are audit-logged.

## API Endpoints

All routes are under `/api/v1/payroll/setup/` and require Finance role (`payroll.write` permission).

- `GET/POST /legal-entities/`
- `GET/POST /pay-schedules/`
- `GET/POST /statutory-configs/`
- `GET/POST /salary-components/`
- `GET/POST /salary-structures/`
- `GET/POST /salary-structure-components/`
- `GET/POST /tax-filing-configs/`
- `GET/POST /pay-stub-templates/`
- `GET/POST /pay-groups/`

All responses follow the standard envelope: `{success: true, data: {...}}` or `{success: false, error: {...}}`.

## Implementation Notes

- Models are designed as independent configuration entities with minimal cross-dependencies.
- The `SalaryStructure` and `SalaryStructureComponent` models are shared with the payslip generation logic (Phase 4).
- Branding assets (logos) for PayStubTemplate are stored through the `documents` app with `entity_type='payroll_asset'`.
- Approval workflow for payroll finalization uses the generic `approvals.Request` primitive.
