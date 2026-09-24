"""
Payroll Calculation Engine - Rule-driven multi-stage calculation.

Stages:
1. Determine salary structure (CTC breakdown)
2. Convert annual to monthly
3. Calculate LOP (Loss of Pay)
4. PF calculation (based on rules)
5. Professional Tax (PT, based on slabs)
6. Insurance deductions
7. TDS calculation
8. Total deductions
9. One-time additions/adjustments
"""

from decimal import Decimal
from datetime import date
from django.utils import timezone
from . import models


class PayrollCalculationEngine:
    def __init__(self, employee, period):
        self.employee = employee
        self.period = period
        self.legal_entity = period.legal_entity
        self.result = {
            'earnings': {},
            'deductions': {},
            'adjustments': {},
            'totals': {},
        }

    def calculate(self):
        """Execute all 9 stages and return payroll result."""
        try:
            # Stage 1 & 2: Load salary structure and convert to monthly
            self._stage_earnings()

            # Stage 3: Calculate LOP
            self._stage_lop()

            # Stage 4: PF calculation
            self._stage_pf()

            # Stage 5: Professional Tax
            self._stage_pt()

            # Stage 6: Insurance
            self._stage_insurance()

            # Stage 7: TDS
            self._stage_tds()

            # Stage 8: Total deductions
            self._stage_total_deductions()

            # Stage 9: One-time additions
            self._stage_adjustments()

            # Calculate net pay
            self._calculate_net_pay()

            return self.result
        except Exception as e:
            return {'error': str(e)}

    def _stage_earnings(self):
        """
        Stage 1 & 2: Load salary structure components and calculate monthly earnings.
        """
        try:
            comp = self.employee.payroll_compensation
            if not comp or not comp.salary_structure:
                self.result['earnings'] = {}
                return

            monthly_ctc = float(comp.fixed_monthly_amount) if comp.fixed_monthly_amount else 0

            # Calculate basic first (needed for formulas)
            basic_amount = 0
            components_data = comp.salary_structure.components.all()

            for sc in components_data:
                component = sc.component
                if component.component_type == 'earning':
                    value = self._evaluate_component(component, monthly_ctc, basic_amount=0)
                    if component.name.lower() == 'basic':
                        basic_amount = value

            # Now recalculate with correct basic
            self.result['earnings'] = {}
            for sc in components_data:
                component = sc.component
                if component.component_type == 'earning':
                    value = self._evaluate_component(component, monthly_ctc, basic_amount)
                    self.result['earnings'][component.name] = value

            self.result['totals']['gross_earnings'] = sum(self.result['earnings'].values())
        except Exception as e:
            self.result['error'] = f"Earnings calculation failed: {str(e)}"

    def _stage_lop(self):
        """
        Stage 3: Calculate Loss of Pay (LOP).
        """
        try:
            # Get LOP configuration
            lop_config = self.legal_entity.lop_config
            lop_days = 0  # TODO: Load from attendance

            if lop_days > 0:
                daily_rate = self.result['totals'].get('gross_earnings', 0) / (
                    lop_config.day_basis == 'fixed_30' and 30 or self.period.working_days
                )
                lop_amount = daily_rate * lop_days
            else:
                lop_amount = 0

            self.result['attendance'] = {
                'working_days': self.period.working_days,
                'lop_days': lop_days,
                'lop_amount': lop_amount,
            }
            self.result['totals']['gross_after_lop'] = (
                self.result['totals'].get('gross_earnings', 0) - lop_amount
            )
        except Exception as e:
            self.result['error'] = f"LOP calculation failed: {str(e)}"

    def _stage_pf(self):
        """
        Stage 4: Calculate Provident Fund (PF) deductions.
        """
        try:
            pf_rule = self.legal_entity.pf_rule
            if not pf_rule or not pf_rule.is_mandatory:
                self.result['deductions']['employee_pf'] = 0
                self.result['deductions']['employer_pf'] = 0
                return

            # PF is calculated on Basic (or configured basis)
            basic = self.result['earnings'].get('Basic', 0)

            # Apply PF wage ceiling if configured
            pf_wage = basic
            if pf_rule.pf_wage_ceiling:
                pf_wage = min(basic, float(pf_rule.pf_wage_ceiling))

            employee_pf = pf_wage * (float(pf_rule.employee_pf_rate) / 100)
            employer_pf = pf_wage * (float(pf_rule.employer_pf_rate) / 100)

            # Only employee PF is deducted from salary; employer PF is company contribution
            self.result['deductions']['employee_pf'] = employee_pf
            self.result['meta'] = self.result.get('meta', {})
            self.result['meta']['employer_pf'] = employer_pf
        except Exception as e:
            self.result['deductions']['employee_pf'] = 0

    def _stage_pt(self):
        """
        Stage 5: Calculate Professional Tax (PT) based on salary slabs.
        """
        try:
            gross = self.result['totals'].get('gross_after_lop', 0)

            # Find applicable PT slab
            pt_slabs = self.legal_entity.pt_slabs.filter(
                effective_from__lte=self.period.start_date
            ).order_by('salary_from')

            pt_amount = 0
            for slab in pt_slabs:
                if gross >= float(slab.salary_from):
                    if slab.salary_to is None or gross <= float(slab.salary_to):
                        pt_amount = float(slab.pt_amount)
                        break

            self.result['deductions']['professional_tax'] = pt_amount
        except Exception as e:
            self.result['deductions']['professional_tax'] = 0

    def _stage_insurance(self):
        """
        Stage 6: Calculate Insurance deductions.
        """
        try:
            insurance = 0
            # Check if employee has active insurance benefit
            active_benefits = self.employee.payroll_benefits.filter(
                is_active=True,
                benefit_type='health_insurance',
                effective_from__lte=self.period.start_date
            )

            for benefit in active_benefits:
                if benefit.employee_contribution:
                    insurance += float(benefit.employee_contribution)

            self.result['deductions']['insurance'] = insurance
        except Exception as e:
            self.result['deductions']['insurance'] = 0

    def _stage_tds(self):
        """
        Stage 7: Calculate TDS (Tax Deducted at Source).

        Simplified: Assume pre-configured monthly TDS (should be linked to statutory filing).
        """
        try:
            # TODO: Implement full TDS calculation based on annual income, tax regime, etc.
            # For now, use a placeholder
            statutory_info = self.employee.payroll_statutory_info

            # Simplified TDS: can be enhanced with actual tax slab logic
            gross_annual = self.result['totals'].get('gross_earnings', 0) * 12

            # Very basic TDS calculation (2% of gross) - replace with actual tax logic
            tds = gross_annual * 0.03 / 12  # 3% annual, divided by 12

            self.result['deductions']['tds'] = tds
        except Exception as e:
            self.result['deductions']['tds'] = 0

    def _stage_total_deductions(self):
        """
        Stage 8: Sum all deductions.
        """
        self.result['totals']['total_deductions'] = sum(self.result['deductions'].values())

    def _stage_adjustments(self):
        """
        Stage 9: Apply one-time adjustments (DIP, Bonus, Arrears, Recovery, etc.).
        """
        try:
            adjustments = models.PayrollAdjustment.objects.filter(
                employee=self.employee,
                effective_from__lte=self.period.start_date,
                frequency='one_time'
            ).exclude(
                effective_to__lt=self.period.start_date
            )

            self.result['adjustments'] = {}
            for adj in adjustments:
                self.result['adjustments'][adj.name] = float(adj.amount)

            self.result['totals']['total_adjustments'] = sum(self.result['adjustments'].values())
        except Exception as e:
            self.result['adjustments'] = {}
            self.result['totals']['total_adjustments'] = 0

    def _calculate_net_pay(self):
        """
        Final calculation: Net Pay = Gross After LOP + Adjustments - Deductions
        """
        gross = self.result['totals'].get('gross_after_lop', 0)
        adjustments = self.result['totals'].get('total_adjustments', 0)
        deductions = self.result['totals'].get('total_deductions', 0)

        self.result['totals']['net_pay'] = gross + adjustments - deductions

    def _evaluate_component(self, component, monthly_ctc, basic_amount=0):
        """
        Evaluate a salary component based on its calculation type.

        Types:
        - fixed: Use default_value directly
        - percentage_of_basic: (default_value / 100) * basic
        - formula: Evaluate formula string
        """
        if component.calculation_type == 'fixed':
            return float(component.default_value or 0)

        elif component.calculation_type == 'percentage_of_basic':
            percentage = float(component.default_value or 0) / 100
            return percentage * basic_amount

        elif component.calculation_type == 'formula':
            formula = component.formula_expr or '0'
            try:
                # Replace variables in formula
                expr = formula.replace('ctc', str(monthly_ctc))
                expr = expr.replace('basic', str(basic_amount))
                # Safely evaluate
                result = eval(expr, {"__builtins__": {}}, {})
                return float(result)
            except Exception:
                return 0

        return 0


def process_payroll_for_period(period, employee_ids=None):
    """
    Process payroll for all or specific employees in a period.

    Args:
        period: PayrollPeriod instance
        employee_ids: Optional list of employee IDs to process

    Returns:
        PayrollRun instance with results
    """
    # Create payroll run
    run = models.PayrollRun.objects.create(
        period=period,
        status='processing'
    )

    # Get employees to process
    query = period.legal_entity.employees.filter(
        payroll_status__is_payroll_enabled=True
    )

    if employee_ids:
        query = query.filter(id__in=employee_ids)

    employees = query.all()

    for employee in employees:
        try:
            # Calculate payroll
            engine = PayrollCalculationEngine(employee, period)
            calc_result = engine.calculate()

            if 'error' in calc_result:
                run.error_count += 1
                continue

            # Get previous payroll result
            previous_result = models.PayrollResult.objects.filter(
                employee=employee,
                run__period__year=period.year - (1 if period.month == 1 else 0),
                run__period__month=12 if period.month == 1 else period.month - 1
            ).first()

            previous_net_pay = previous_result.net_pay if previous_result else None

            # Create payroll result
            payroll_result = models.PayrollResult.objects.create(
                run=run,
                employee=employee,
                earnings_json=calc_result.get('earnings', {}),
                total_earnings=calc_result.get('totals', {}).get('gross_earnings', 0),
                working_days=calc_result.get('attendance', {}).get('working_days', 0),
                lop_days=calc_result.get('attendance', {}).get('lop_days', 0),
                lop_amount=calc_result.get('attendance', {}).get('lop_amount', 0),
                gross_after_lop=calc_result.get('totals', {}).get('gross_after_lop', 0),
                deductions_json=calc_result.get('deductions', {}),
                total_deductions=calc_result.get('totals', {}).get('total_deductions', 0),
                adjustments_json=calc_result.get('adjustments', {}),
                total_adjustments=calc_result.get('totals', {}).get('total_adjustments', 0),
                net_pay=calc_result.get('totals', {}).get('net_pay', 0),
                previous_net_pay=previous_net_pay,
                variance=(
                    calc_result.get('totals', {}).get('net_pay', 0) - previous_net_pay
                    if previous_net_pay is not None
                    else None
                ),
            )

            run.processed_count += 1
            run.total_net_pay += payroll_result.net_pay

        except Exception as e:
            run.error_count += 1

    # Update run status
    run.status = 'completed'
    run.save()

    return run
