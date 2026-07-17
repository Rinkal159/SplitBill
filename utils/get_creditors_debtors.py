def get_creditors_debtors(splits, creditors, debtors):
    for split in splits:
        balance = split.paid_amount - split.share_amount
        if balance > 0:
            creditors.append({"user": split.user, "balance": balance})
        elif balance < 0:
            debtors.append({"user": split.user, "balance": balance})