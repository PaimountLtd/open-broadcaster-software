import React, { HTMLAttributes } from 'react';
import ExclamationCircleOutlined from '@ant-design/icons';

// TODO: add more types

export default function Message(p: { type: 'warning' & HTMLAttributes<unknown> }) {
  const type = p.type;
  const classProp = `ant-message-custom-content ant-message-${type}`;
  return (
    <div className={classProp}>
      <ExclamationCircleOutlined color="orange" /> {p.children}
    </div>
  );
}
