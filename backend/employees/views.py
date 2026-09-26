from datetime import date
import openpyxl

from django.db import transaction
from django.db.models import Count, Q
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.services import revoke_all_sessions
from audit.mixins import AuditedModelViewSet
from audit.service import write_audit
from core.api import FrontendEnvelopeMixin
from core.enums import EmployeeStatus
from core.exceptions import Conflict
from core.permissions import HasPermissionCode, ScopedEmployeePermission
from core.scope import resolve_employee_scope, user_has_permission
from employees.models import (
    BusinessUnit,
    CostCenter,
    Department,
    Designation,
    Employee,
    Grade,
    JobFamily,
    LegalEntity,
    Level,
    Location,
    Position,
    Team,
)
from employees.serializers import (
    BusinessUnitAdminSerializer,
    BusinessUnitSerializer,
    CostCenterAdminSerializer,
    CostCenterSerializer,
    DepartmentAdminSerializer,
    DepartmentSerializer,
    DesignationAdminSerializer,
    DesignationSerializer,
    EmployeeSerializer,
    EmployeeWriteSerializer,
    EssProfileSerializer,
    EssProfileWriteSerializer,
    GradeAdminSerializer,
    GradeSerializer,
    JobFamilyAdminSerializer,
    JobFamilySerializer,
    LegalEntityAdminSerializer,
    LegalEntitySerializer,
    LevelAdminSerializer,
    LevelSerializer,
    LocationAdminSerializer,
    LocationSerializer,
    PersonalSerializer,
    PositionAdminSerializer,
    PositionSerializer,
    TeamAdminSerializer,
    TeamSerializer,
)


class OrgDirectoryViewSet(FrontendEnvelopeMixin, viewsets.ReadOnlyModelViewSet):
    """Company-wide, read-only org directory — the source for the Organisation
    page's chart and directory tabs. Every authenticated user sees the whole
    company (names, titles, reporting lines), independent of RBAC scope, so the
    org chart is complete for everyone. Deliberately unscoped: this is directory
    data, not the sensitive per-employee surface (payroll, personal details,
    edits) which stays scoped on EmployeeViewSet and the admin endpoints. Reuses
    EmployeeSerializer (no salary/bank fields) → same {success, data} snake_case
    shape as /employees. Exited people are excluded so the chart shows the
    current org."""

    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Employee.objects.select_related(
                "user",
                "manager__user",
                "department",
                "designation",
                "location",
                "legal_entity",
                "business_unit",
                "cost_center",
                "position",
                "level",
                "grade",
            )
            .exclude(status=EmployeeStatus.EXITED)
            .order_by("user__first_name", "user__last_name")
        )


class EmployeeViewSet(
    FrontendEnvelopeMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.ReadOnlyModelViewSet,
):
    """The employee directory.

    Reading: `list` is filtered through resolve_employee_scope() so each caller
    only sees who their `employees.read` scope covers; `retrieve` on an
    out-of-scope employee is an explicit 403 (ScopedEmployeePermission), not a
    filtered-away 404 (docs/TASKS.md P1-SH-01). Optional filters on the list:
    ?department= ?location= ?status= ?no_manager=1 (plus ?search=).

    Writing (`employees.write`, scoped the same way): create and PATCH only, no
    PUT and no DELETE. Someone leaving is a status change to `exited`, which
    also ends their access and records the exit date. A write may never move a
    person, or point a manager, outside the caller's own write scope.

    Personal details (personal email, phone, date of birth, gender, exit
    reason) are kept out of the ordinary directory and live at
    /employees/{id}/personal/, behind employees.personal.read / .write."""

    serializer_class = EmployeeSerializer
    permission_classes = [ScopedEmployeePermission]
    required_permission = "employees.read"
    write_permission = "employees.write"
    action_permissions = {
        "personal": "employees.personal.read",
        "bulk_upload": "employees.write",
        "metadata": "employees.read"
    }
    http_method_names = ["get", "post", "patch", "head", "options"]
    filter_backends = [filters.SearchFilter]
    search_fields = ["employee_code", "user__first_name", "user__last_name", "user__email"]

    def get_queryset(self):
        base = Employee.objects.select_related(
            "user",
            "manager__user",
            "department",
            "designation",
            "location",
            "legal_entity",
            "business_unit",
            "cost_center",
            "position",
            "level",
            "grade",
        )
        if self.action != "list":
            return base
        params = self.request.query_params
        queryset = base.filter(
            pk__in=resolve_employee_scope(self.request.user, self.required_permission)
        )
        if params.get("department"):
            queryset = queryset.filter(department_id=params["department"])
        if params.get("location"):
            queryset = queryset.filter(location_id=params["location"])
        if params.get("status"):
            queryset = queryset.filter(status=params["status"])
        if params.get("no_manager") in ("1", "true"):
            queryset = queryset.filter(manager__isnull=True)
        return queryset

    def get_serializer_class(self):
        if self.action in ("create", "partial_update"):
            return EmployeeWriteSerializer
        return super().get_serializer_class()

    # -- writes -------------------------------------------------------------

    def _write_scope(self):
        return resolve_employee_scope(self.request.user, self.write_permission)

    def _require_in_write_scope(self, employee, message):
        if not self._write_scope().filter(pk=employee.pk).exists():
            raise PermissionDenied(message)

    def _require_manager_in_write_scope(self, serializer):
        manager = serializer.validated_data.get("manager")
        if manager is not None:
            self._require_in_write_scope(
                manager, "The chosen manager is outside the records you may edit."
            )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            self._require_manager_in_write_scope(serializer)
            employee = serializer.save()
            # The new record must fall inside the caller's own write scope, or a
            # narrow editor could create people they can never see again.
            self._require_in_write_scope(
                employee, "You may not create employees outside your own scope."
            )
            write_audit(
                request.user,
                "Employee.created",
                "Employee",
                employee.pk,
                {"after": EmployeeSerializer(employee).data},
            )
        return Response(
            {"success": True, "data": EmployeeSerializer(employee).data},
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        employee = self.get_object()  # scope-checked against employees.write
        before = EmployeeSerializer(employee).data
        old_status = employee.status
        serializer = self.get_serializer(employee, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            self._require_manager_in_write_scope(serializer)
            employee = serializer.save()
            self._require_in_write_scope(
                employee, "You may not move an employee outside your own scope."
            )
            self._apply_status_change(request.user, employee, old_status)
            write_audit(
                request.user,
                "Employee.updated",
                "Employee",
                employee.pk,
                {"before": before, "after": EmployeeSerializer(employee).data},
            )
        return Response({"success": True, "data": EmployeeSerializer(employee).data})

    def _apply_status_change(self, actor, employee, old_status):
        """Status is the source of truth for whether someone can sign in: exiting
        ends their access at once and records the exit date; reactivating
        restores access and clears the exit details."""
        exited = EmployeeStatus.EXITED
        user = employee.user
        if employee.status == exited and old_status != exited:
            user.is_active = False
            user.save(update_fields=["is_active"])
            revoked = revoke_all_sessions(user)
            if employee.date_of_exit is None:
                employee.date_of_exit = date.today()
                employee.save(update_fields=["date_of_exit"])
            write_audit(
                actor, "Employee.exited", "Employee", employee.pk, {"sessionsRevoked": revoked}
            )
        elif old_status == exited and employee.status != exited:
            user.is_active = True
            user.save(update_fields=["is_active"])
            employee.date_of_exit = None
            employee.exit_reason = ""
            employee.save(update_fields=["date_of_exit", "exit_reason"])
            write_audit(actor, "Employee.reactivated", "Employee", employee.pk)

    # -- personal details ---------------------------------------------------

    @action(detail=True, methods=["get", "patch"], url_path="personal")
    def personal(self, request, pk=None):
        """Personal details of one employee. Reading needs employees.personal.read
        for that person; changing them additionally needs employees.personal.write
        for that person. The audit entry lists which fields changed, never the
        values."""
        employee = self.get_object()  # scope-checked against employees.personal.read
        if request.method == "PATCH":
            allowed = resolve_employee_scope(request.user, "employees.personal.write")
            if not allowed.filter(pk=employee.pk).exists():
                raise PermissionDenied("You may not change this person's personal details.")
            serializer = PersonalSerializer(employee, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            changed = sorted(serializer.validated_data)
            serializer.save()
            write_audit(
                request.user,
                "Employee.personal_updated",
                "Employee",
                employee.pk,
                {"fields": changed},
            )
        return Response({"success": True, "data": PersonalSerializer(employee).data})

    # -- bulk upload (superadmin only) -------------------------------------------

    @action(detail=False, methods=["post"], url_path="bulk-upload", parser_classes=[MultiPartParser, FormParser])
    def bulk_upload(self, request):
        """Bulk upload employees from Excel file (superadmin only)."""
        if not user_has_permission(request.user, "employees.write"):
            raise PermissionDenied("You do not have permission to perform bulk upload.")

        if 'file' not in request.FILES:
            return Response(
                {'success': False, 'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        file_obj = request.FILES['file']

        try:
            wb = openpyxl.load_workbook(file_obj)
            ws = wb.active

            # Headers are on row 3
            headers = [cell.value for cell in ws[3]]

            results = {
                'created': [],
                'updated': [],
                'skipped': [],
                'errors': [],
                'departments_created': set(),
                'designations_created': set(),
            }

            # Helper to find column by name (case-insensitive, handles variations)
            def get_column(row_dict, *possible_names):
                for name in possible_names:
                    for key in row_dict.keys():
                        if key and key.lower().strip() == name.lower().strip():
                            val = row_dict[key]
                            return val.strip() if val and isinstance(val, str) else (val or '')
                return ''

            # Process each row starting from row 4
            for row_num, row in enumerate(ws.iter_rows(min_row=4, values_only=True), start=4):
                row_dict = dict(zip(headers, row))

                emp_code = get_column(row_dict, 'Employee Number', 'Employee Code', 'Code')
                first_name = get_column(row_dict, 'First Name', 'FirstName', 'first_name')
                last_name = get_column(row_dict, 'Last Name', 'LastName', 'last_name')
                email = get_column(row_dict, 'Reporting Manager Email', 'Manager Email', 'Email')
                job_title = get_column(row_dict, 'Job Title', 'Title', 'Designation')
                department = get_column(row_dict, 'Department', 'Dept')
                status_val = get_column(row_dict, 'Employment Status', 'Status') or 'Working'
                date_joined = get_column(row_dict, 'Date Joined', 'Joining Date', 'DOJ')

                # Validate required fields
                if not emp_code or not first_name:
                    results['skipped'].append({'row': row_num, 'reason': 'Missing employee code or name'})
                    continue

                try:
                    # Generate email if missing
                    if not email:
                        email = f'{first_name.lower()}.{last_name.lower()}@consult-4at.com'

                    # Generate username
                    username = email.split('@')[0].lower()

                    # Parse date
                    from datetime import datetime
                    date_of_joining = None
                    if date_joined:
                        try:
                            if isinstance(date_joined, str):
                                date_of_joining = datetime.strptime(date_joined.strip(), '%d-%b-%Y').date()
                            elif hasattr(date_joined, 'date'):
                                date_of_joining = date_joined.date()
                        except:
                            pass

                    # Create/get department
                    dept = None
                    if department:
                        dept, dept_created = Department.objects.get_or_create(
                            name=department,
                            defaults={'is_active': True}
                        )
                        if dept_created:
                            results['departments_created'].add(department)

                    # Create/get designation
                    desig = None
                    if job_title:
                        desig, desig_created = Designation.objects.get_or_create(
                            name=job_title,
                            defaults={'is_active': True}
                        )
                        if desig_created:
                            results['designations_created'].add(job_title)

                    # Simple: just create/update employee by code
                    employee, created = Employee.objects.update_or_create(
                        employee_code=emp_code,
                        defaults={
                            'department': dept,
                            'designation': desig,
                            'status': 'active' if status_val == 'Working' else 'inactive',
                            'date_of_joining': date_of_joining,
                        }
                    )

                    if created:
                        results['created'].append({
                            'employee_code': emp_code,
                            'name': f'{first_name} {last_name}'
                        })
                    else:
                        results['updated'].append({
                            'employee_code': emp_code,
                            'name': f'{first_name} {last_name}'
                        })

                except Exception as e:
                    results['errors'].append({
                        'row': row_num,
                        'employee_code': emp_code,
                        'error': str(e)
                    })

            # Convert sets to lists for JSON
            results['departments_created'] = list(results['departments_created'])
            results['designations_created'] = list(results['designations_created'])
            results['summary'] = {
                'total_created': len(results['created']),
                'total_updated': len(results['updated']),
                'total_skipped': len(results['skipped']),
                'total_errors': len(results['errors']),
            }

            return Response({
                'success': True,
                'data': results
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'success': False, 'error': f'Failed to process file: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class EssProfileView(APIView):
    """A person's own profile (self-service). The employee is always the caller;
    there is no id to tamper with. GET needs ess.profile.read, PUT/PATCH need
    ess.profile.write, and only contact details, date of birth and gender can
    be changed."""

    renderer_classes = [JSONRenderer]
    parser_classes = [JSONParser]
    permission_classes = [IsAuthenticated]

    def _employee(self, request, code):
        if not user_has_permission(request.user, code):
            raise PermissionDenied("You do not have permission to do this.")
        employee = getattr(request.user, "employee", None)
        if employee is None:
            raise NotFound("This account has no employee record.")
        return employee

    def get(self, request):
        employee = self._employee(request, "ess.profile.read")
        return Response({"success": True, "data": EssProfileSerializer(employee).data})

    def _update(self, request):
        employee = self._employee(request, "ess.profile.write")
        serializer = EssProfileWriteSerializer(employee, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        changed = sorted(serializer.validated_data)
        serializer.save()
        write_audit(
            request.user,
            "Employee.profile_self_updated",
            "Employee",
            employee.pk,
            {"fields": changed},
        )
        return Response({"success": True, "data": EssProfileSerializer(employee).data})

    def put(self, request):
        return self._update(request)

    def patch(self, request):
        return self._update(request)


# ---- read-only reference lists the frontend pages read ({success, data}) ----


class _EmployeeReadOnlyReferenceViewSet(FrontendEnvelopeMixin, viewsets.ReadOnlyModelViewSet):
    """Shared shape for the small org-dimension reference lists below — not
    employee-keyed, so anyone who can read the directory can read these (they're
    what the directory's department/location/etc. filters populate)."""

    permission_classes = [HasPermissionCode]
    required_permission = "employees.read"


class DepartmentViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = Department.objects.filter(is_active=True)
    serializer_class = DepartmentSerializer


class DesignationViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = Designation.objects.filter(is_active=True)
    serializer_class = DesignationSerializer


class LocationViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = Location.objects.filter(is_active=True)
    serializer_class = LocationSerializer


class LegalEntityViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = LegalEntity.objects.filter(is_active=True)
    serializer_class = LegalEntitySerializer


class BusinessUnitViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = BusinessUnit.objects.filter(is_active=True)
    serializer_class = BusinessUnitSerializer


class CostCenterViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = CostCenter.objects.filter(is_active=True)
    serializer_class = CostCenterSerializer


class TeamViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = Team.objects.filter(is_active=True).select_related("department", "lead__user")
    serializer_class = TeamSerializer


class JobFamilyViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = JobFamily.objects.filter(is_active=True)
    serializer_class = JobFamilySerializer


class LevelViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = Level.objects.filter(is_active=True)
    serializer_class = LevelSerializer


class GradeViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = Grade.objects.filter(is_active=True)
    serializer_class = GradeSerializer


class PositionViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = (
        Position.objects.filter(is_active=True)
        .select_related(
            "department",
            "job_title",
            "level",
            "grade",
            "business_unit",
            "reports_to",
            "incumbent__user",
        )
        .order_by("name")
    )
    serializer_class = PositionSerializer


# ---- managing the organisation structure (org.manage) ----


class _OrgUnitAdminViewSet(AuditedModelViewSet):
    """Create, rename, deactivate and delete one kind of organisation unit.
    Every change is audited. A unit that people still belong to cannot be
    deleted (a clear 409 that suggests deactivating instead); a deactivated unit
    disappears from the pickers but keeps its history. ?search= filters by name
    (or code)."""

    permission_classes = [HasPermissionCode]
    required_permission = "org.manage"
    model = None
    search_on_code = False

    def get_queryset(self):
        queryset = self.model.objects.annotate(employee_count=Count("employees", distinct=True))
        search = self.request.query_params.get("search")
        if search:
            match = Q(name__icontains=search)
            if self.search_on_code:
                match |= Q(code__icontains=search)
            queryset = queryset.filter(match)
        return queryset.order_by("name")

    def _blockers(self, instance):
        return instance.employees.count()

    def perform_destroy(self, instance):
        in_use = self._blockers(instance)
        if in_use:
            raise Conflict(
                f"{in_use} {'person is' if in_use == 1 else 'people are'} still assigned to "
                f"'{instance.name}'. Move them first, or deactivate it instead of deleting it."
            )
        super().perform_destroy(instance)


class DepartmentAdminViewSet(_OrgUnitAdminViewSet):
    model = Department
    serializer_class = DepartmentAdminSerializer
    audit_entity_type = "Department"

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .select_related("parent")
            .annotate(child_count=Count("children", distinct=True))
        )

    def _blockers(self, instance):
        return instance.employees.count() + instance.children.count()

    def perform_destroy(self, instance):
        people, children = instance.employees.count(), instance.children.count()
        if children:
            noun = "sub-department" if children == 1 else "sub-departments"
            raise Conflict(
                f"'{instance.name}' has {children} {noun}. "
                "Move or remove them first, or deactivate it instead of deleting it."
            )
        if people:
            raise Conflict(
                f"{people} {'person is' if people == 1 else 'people are'} still assigned to "
                f"'{instance.name}'. Move them first, or deactivate it instead of deleting it."
            )
        AuditedModelViewSet.perform_destroy(self, instance)


class DesignationAdminViewSet(_OrgUnitAdminViewSet):
    model = Designation
    serializer_class = DesignationAdminSerializer
    audit_entity_type = "Designation"


class LocationAdminViewSet(_OrgUnitAdminViewSet):
    model = Location
    serializer_class = LocationAdminSerializer
    audit_entity_type = "Location"


class LegalEntityAdminViewSet(_OrgUnitAdminViewSet):
    model = LegalEntity
    serializer_class = LegalEntityAdminSerializer
    audit_entity_type = "LegalEntity"


class BusinessUnitAdminViewSet(_OrgUnitAdminViewSet):
    model = BusinessUnit
    serializer_class = BusinessUnitAdminSerializer
    audit_entity_type = "BusinessUnit"


class CostCenterAdminViewSet(_OrgUnitAdminViewSet):
    model = CostCenter
    serializer_class = CostCenterAdminSerializer
    audit_entity_type = "CostCenter"
    search_on_code = True


class TeamAdminViewSet(AuditedModelViewSet):
    """Teams are referenced by nothing, so there is nothing to block on —
    every change is still audited. ?search= filters by team name."""

    permission_classes = [HasPermissionCode]
    required_permission = "org.manage"
    serializer_class = TeamAdminSerializer
    audit_entity_type = "Team"

    def get_queryset(self):
        queryset = Team.objects.select_related("department", "lead__user")
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset.order_by("name")


class JobFamilyAdminViewSet(AuditedModelViewSet):
    """Job families are referenced by nothing, so like teams they carry no
    delete blockers. ?search= filters by name."""

    permission_classes = [HasPermissionCode]
    required_permission = "org.manage"
    serializer_class = JobFamilyAdminSerializer
    audit_entity_type = "JobFamily"

    def get_queryset(self):
        queryset = JobFamily.objects.all()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset.order_by("name")


class _JobArchAdminViewSet(_OrgUnitAdminViewSet):
    """Level/Grade admin: people may sit at a level/grade directly (Employee
    FKs) and approved seats may point at it (Position FKs) — both block a
    delete, and both counts are reported on the row."""

    def get_queryset(self):
        return super().get_queryset().annotate(position_count=Count("positions", distinct=True))

    def _blockers(self, instance):
        return instance.employees.count() + instance.positions.count()

    def perform_destroy(self, instance):
        in_use = self._blockers(instance)
        if in_use:
            noun = "assignment" if in_use == 1 else "assignments"
            raise Conflict(
                f"{in_use} people/seat {noun} still point at "
                f"'{instance.name}'. Move them first, or deactivate it instead of deleting it."
            )
        AuditedModelViewSet.perform_destroy(self, instance)


class LevelAdminViewSet(_JobArchAdminViewSet):
    model = Level
    serializer_class = LevelAdminSerializer
    audit_entity_type = "Level"


class GradeAdminViewSet(_JobArchAdminViewSet):
    model = Grade
    serializer_class = GradeAdminSerializer
    audit_entity_type = "Grade"


class PositionAdminViewSet(AuditedModelViewSet):
    """Approved seats. ?search= filters by seat name, ?status= by seat status.
    Deleting a seat is allowed (it is just an approval record) and audited."""

    permission_classes = [HasPermissionCode]
    required_permission = "org.manage"
    serializer_class = PositionAdminSerializer
    audit_entity_type = "Position"

    def get_queryset(self):
        queryset = Position.objects.select_related(
            "department",
            "job_title",
            "level",
            "grade",
            "business_unit",
            "reports_to",
            "incumbent__user",
        )
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)
        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(status=status)
        return queryset.order_by("name")
