from decimal import Decimal

def get_creditors_debtors(splits, creditors, debtors, settlement_groups):
    balance_creditors = {}
    
    for split in splits:
        balance = split.paid_amount - split.share_amount
        if balance > 0:
            creditors.append({"user": split.user, "balance": balance})
            
        elif balance < 0:
            existed_settlement = settlement_groups.get(split.id, [])
            
            total_amount_settled = Decimal("0")
            
            if existed_settlement:
                for settlement_split in existed_settlement:
                    total_amount_settled += settlement_split.amount_settled
                
                    creditor_id = settlement_split.settlement.to_user
                    balance_creditors[creditor_id] = balance_creditors.get(creditor_id, Decimal("0")) + settlement_split.amount_settled
                
            
            balance += total_amount_settled
            
            if balance < 0:
                debtors.append({"user": split.user, "balance": balance})
                
    
    for c in creditors:
        remaining = c["balance"] - balance_creditors.get(
            c["user"].id,
            Decimal("0")
        )
        
        if remaining > 0:
            c["balance"] = remaining
        else:
            c["balance"] = Decimal("0")
        