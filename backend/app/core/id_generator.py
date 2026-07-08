from sqlalchemy import Column, String, text


ID_LENGTH = 15
ID_NUMBER_WIDTH = 8


def prefixed_id_server_default(prefix: str, sequence_name: str):
    return text(f"'{prefix}' || lpad(nextval('{sequence_name}')::text, {ID_NUMBER_WIDTH}, '0')")


def prefixed_id_column(prefix: str, sequence_name: str, *, unique: bool = False):
    return Column(
        String(ID_LENGTH),
        primary_key=True,
        nullable=False,
        unique=unique,
        server_default=prefixed_id_server_default(prefix, sequence_name),
    )
