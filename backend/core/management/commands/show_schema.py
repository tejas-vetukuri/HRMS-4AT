"""Print the database schema of the project's own tables, straight from the
models (so it can never drift from what migrations create).

    python manage.py show_schema                 # tables, columns, keys
    python manage.py show_schema --counts        # ...plus live row counts
    python manage.py show_schema --mermaid       # an ER diagram (renders on GitHub)
    python manage.py show_schema --mermaid --out SCHEMA.mmd
    python manage.py show_schema --all           # include Django's own tables

Only the project's apps are shown by default; Django's admin/auth/session
tables and the JWT blacklist tables are framework internals.
"""

from django.apps import apps
from django.core.management.base import BaseCommand


def _is_project_app(app_config):
    path = str(app_config.path).replace("\\", "/")
    return "site-packages" not in path and ".venv" not in path


def _fk_target(field):
    return field.remote_field.model


def _flags(field):
    flags = []
    if field.primary_key:
        flags.append("PK")
    elif field.unique:
        flags.append("unique")
    if field.null:
        flags.append("nullable")
    return flags


class Command(BaseCommand):
    help = "Print the project's database schema, optionally as a Mermaid ER diagram."

    def add_arguments(self, parser):
        parser.add_argument("--counts", action="store_true", help="Show live row counts.")
        parser.add_argument("--mermaid", action="store_true", help="Output a Mermaid ER diagram.")
        parser.add_argument("--all", action="store_true", help="Include Django's own tables.")
        parser.add_argument("--out", metavar="FILE", help="Write the output to FILE.")

    def handle(self, *args, **options):
        models = [
            m
            for m in apps.get_models()
            if options["all"] or _is_project_app(apps.get_app_config(m._meta.app_label))
        ]
        models.sort(key=lambda m: (m._meta.app_label, m._meta.db_table))
        text = (
            self._mermaid(models) if options["mermaid"] else self._text(models, options["counts"])
        )
        if options["out"]:
            with open(options["out"], "w", encoding="utf-8") as f:
                f.write(text + "\n")
            self.stdout.write(f"Wrote {options['out']}")
        else:
            self.stdout.write(text)

    # -- plain text -------------------------------------------------------

    def _text(self, models, counts):
        lines = []
        for model in models:
            meta = model._meta
            title = f"{meta.db_table}  ({meta.app_label}.{meta.object_name})"
            if counts:
                title += f"  -  {model._default_manager.count()} rows"
            lines += [title, "-" * len(title)]
            for field in meta.concrete_fields:
                type_ = field.get_internal_type()
                if field.is_relation:
                    target = _fk_target(field)._meta
                    on_delete = field.remote_field.on_delete.__name__
                    type_ = f"-> {target.db_table}.{target.pk.column}  on_delete={on_delete}"
                lines.append(f"  {field.column:<22} {type_:<58} {', '.join(_flags(field))}")
            for constraint in meta.constraints:
                cols = getattr(constraint, "fields", ())
                lines.append(f"  constraint: {constraint.name} {tuple(cols)}")
            lines.append("")
        return "\n".join(lines)

    # -- mermaid ------------------------------------------------------------

    def _mermaid(self, models):
        shown = set(models)
        out = ["erDiagram"]
        relations = []
        for model in models:
            meta = model._meta
            out.append(f"    {meta.object_name} {{")
            for field in meta.concrete_fields:
                marks = []
                if field.primary_key:
                    marks.append("PK")
                elif field.is_relation:
                    marks.append("FK")
                if field.unique and not field.primary_key:
                    marks.append("UK")
                type_ = field.get_internal_type()
                out.append(f"        {type_} {field.column} {','.join(marks)}".rstrip())
                if field.is_relation and _fk_target(field) in shown:
                    target = _fk_target(field)._meta.object_name
                    if field.one_to_one:
                        left = "|o" if field.null else "||"
                        relations.append(
                            f'    {target} {left}--o| {meta.object_name} : "{field.name}"'
                        )
                    else:
                        left = "|o" if field.null else "||"
                        relations.append(
                            f'    {target} {left}--o{{ {meta.object_name} : "{field.name}"'
                        )
            out.append("    }")
        return "\n".join(out + relations)
