import styles from './Loader.module.css';

// className: extra class for the outer box (a page passes its own so its styles still apply while loading)
function Loader({ text = 'Trying my best...', className = '' }) {
    return (
        <div className={className ? `${styles.loader} ${className}` : styles.loader} role="status" aria-live='polite'>
            <div className={styles.ring}></div>
            <p>{text}</p>
        </div>
    );
}

export default Loader;
