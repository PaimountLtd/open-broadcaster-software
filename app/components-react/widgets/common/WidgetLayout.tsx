import { Button, Col, Collapse, Layout, Row, Spin } from 'antd';
import React, { ReactNode } from 'react';
import { useWidget } from './useWidget';
import Display from '../../shared/Display';
import css from './WidgetLayout.m.less';
import Form, { useForm } from '../../shared/inputs/Form';
import { ObsForm } from '../../obs/ObsForm';
import { $t } from '../../../services/i18n';
import { CustomCodeSection } from './CustomCode';
import { CustomFieldsSection } from './CustomFields';
import { ButtonGroup } from '../../shared/ButtonGroup';
import { RollbackOutlined } from '@ant-design/icons';
const { Content, Header, Footer } = Layout;

/**
 * A layout component for all widgets
 * Can display 1 column or 2 columns depending on how many children have been provided to props
 */
export function WidgetLayout(p: { children: ReactNode | [ReactNode, ReactNode] }) {
  const {
    previewSourceId,
    isLoading,
    selectedTab,
    config,
    hasCustomFields,
    close,
    canRevert,
    revertChanges,
  } = useWidget();
  let MenuPanel: ReactNode;
  let ContentPanel: ReactNode;

  // check if MenuPanel is defined
  if (Array.isArray(p.children)) {
    [MenuPanel, ContentPanel] = p.children;
  } else {
    ContentPanel = p.children;
  }

  const form = useForm();
  return (
    <Layout className={css.widgetLayout} style={{ height: '100%' }}>
      {/* DISPLAY */}
      <Header style={{ height: '250px', padding: 0 }}>
        <Display sourceId={previewSourceId} />
      </Header>
      <Content>
        <Row style={{ height: '100%', borderTop: '1px solid var(--border)' }}>
          {/* MENU  */}
          {MenuPanel && (
            <Col
              flex="270px"
              style={{
                borderRight: '1px solid var(--border)',
                backgroundColor: 'var(--section)',
              }}
            >
              {!isLoading && MenuPanel}
            </Col>
          )}

          {/* TAB CONTENT  */}
          <Col
            flex="auto"
            style={{ padding: '16px', paddingTop: '32px', height: '100%', overflow: 'auto' }}
          >
            <Form form={form} layout="horizontal">
              <Spin spinning={isLoading}>
                {!isLoading && (
                  <>
                    {/* SETTINGS FORM  */}
                    {ContentPanel}

                    {/* BROWSER SOURCE SETTINGS  */}
                    {selectedTab === 'general' && <BrowserSourceSettings />}

                    {/* CUSTOM CODE  */}
                    {config.customCodeAllowed && <CustomCodeSection />}

                    {/* CUSTOM FIELDS  */}
                    {hasCustomFields && <CustomFieldsSection />}
                  </>
                )}
              </Spin>
            </Form>
          </Col>
        </Row>
      </Content>

      {/* FOOTER BUTTONS  */}
      <div className="ant-modal-footer">
        {canRevert && (
          <Button
            onClick={revertChanges}
            type="ghost"
            style={{ position: 'absolute', left: '16px' }}
          >
            <RollbackOutlined />
            {$t('Revert Changes')}
          </Button>
        )}
        <Button onClick={close}>{$t('Close')}</Button>
      </div>
    </Layout>
  );
}

/**
 * Renders a collapsable section with browser source settings for the widget
 */
function BrowserSourceSettings() {
  const { browserSourceProps, updateBrowserSourceProps } = useWidget();
  return (
    <>
      <Collapse bordered={false}>
        <Collapse.Panel header={$t('Browser Settings')} key={1}>
          <ObsForm
            value={browserSourceProps}
            onChange={updateBrowserSourceProps}
            layout="horizontal"
          />
        </Collapse.Panel>
      </Collapse>
    </>
  );
}
